import { db, TxOrDb } from "@repo/database";
import { shift, shiftAssignment, rateLimitState, idempotencyKey as idempotencyKeyTable, workerAvailability, scheduledNotification, location, workerNotificationPreferences } from "@repo/database/schema";
import { eq, and, lt, gt, inArray, like, sql } from "drizzle-orm";
import { addMinutes, addDays } from "date-fns";
import { z } from "zod";



import { fromZonedTime } from "date-fns-tz";
import { AppError } from "@repo/observability";
import { newId } from "../utils/ids";
import { expandRecurringDates, RecurrenceConfig } from "../utils/recurrence";
import { createHash } from "crypto";
import { buildNotificationSchedule } from "@repo/notifications";

// Rate Limiting
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;

const PublishSchema = z.object({
    idempotencyKey: z.string().optional(),
    locationId: z.string(),
    contactId: z.string().optional(),
    organizationId: z.string(),
    timezone: z.string().refine((val) => {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: val });
            return true;
        } catch (e) {
            return false;
        }
    }, { message: "Invalid Timezone ID" }),
    recurrence: z.object({
        enabled: z.boolean(),
        pattern: z.enum(['weekly', 'biweekly']),
        daysOfWeek: z.array(z.number().min(0).max(6)),
        endType: z.enum(['after_weeks', 'on_date']),
        endAfter: z.number().min(1).max(12).optional(),
        endDate: z.string().optional()
    }).optional(),
    status: z.enum(['draft', 'published']).optional().default('published'),
    schedules: z.array(z.object({
        startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
        dates: z.array(z.string()).min(1, "Dates array cannot be empty").max(31, "Cannot publish more than 31 days at once"),
        scheduleName: z.string(),
        positions: z.array(z.object({
            roleName: z.string(),
            price: z.number().optional(),
            workerIds: z.array(z.string().nullable()).max(50, "Cannot exceed 50 positions per role")
        }))
    }))
});

export const publishSchedule = async (body: any, headerOrgId: string, tx?: TxOrDb) => {
    // WH-111: Rate Limiting
    const rateLimitKey = `publish_schedule:${headerOrgId}`;


    const windowMs = RATE_LIMIT_WINDOW;
    const nowMs = Date.now();

    const [limitState] = await db
        .insert(rateLimitState)
        .values({
            key: rateLimitKey,
            count: 1,
            windowStart: String(nowMs)
        })
        .onConflictDoUpdate({
            target: rateLimitState.key,
            set: {
                count: sql`CASE 
                    WHEN (${nowMs} - CAST(${rateLimitState.windowStart} AS NUMERIC)) > ${windowMs} THEN 1 
                    ELSE ${rateLimitState.count} + 1 
                END`,
                windowStart: sql`CASE 
                    WHEN (${nowMs} - CAST(${rateLimitState.windowStart} AS NUMERIC)) > ${windowMs} THEN ${String(nowMs)} 
                    ELSE ${rateLimitState.windowStart} 
                END`
            }
        })
        .returning();

    if (limitState && limitState.count > MAX_REQUESTS) {
        const windowStart = Number(limitState.windowStart);
        const retryAfter = Math.ceil((windowStart + windowMs - nowMs) / 1000);
        throw new AppError("Rate limit exceeded. Please try again later.", "RATE_LIMIT_EXCEEDED", 429, {
            retryAfter: retryAfter > 0 ? retryAfter : 60
        });
    }

    const parseResult = PublishSchema.safeParse(body);

    if (!parseResult.success) {
        throw new AppError("Validation Failed", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const { idempotencyKey, locationId, contactId, organizationId, timezone, status, schedules, recurrence } = parseResult.data;




    // Security Check: Header vs Body
    if (organizationId && organizationId !== headerOrgId) {

        throw new AppError("Organization mismatch", "FORBIDDEN", 403);
    }
    // Force use of header-derived orgId
    const activeOrgId = headerOrgId;


    // WH-140: Robust Idempotency with Payload Hashing
    // Generate a deterministic hash of the critical payload configuration
    // We include schedules and recurrence settings.

    const payloadString = JSON.stringify({ schedules, recurrence, locationId, organizationId });



    const payloadHash = createHash('sha256').update(payloadString).digest('hex');


    // WH-110: Idempotency Check [ARCH-007: Decoupled Table]

    if (idempotencyKey) {
        const existingKey = await db.query.idempotencyKey.findFirst({
            where: and(
                eq(idempotencyKeyTable.key, idempotencyKey),
                eq(idempotencyKeyTable.organizationId, activeOrgId)
            )
        });

        if (existingKey) {
            if (existingKey.hash === payloadHash) {
                console.log(`Idempotency hit for key: ${idempotencyKey}`);
                // Return cached response logic could go here if we stored it
                return {
                    success: true,
                    message: "Batch already processed (Idempotent)",
                    batchId: idempotencyKey,
                    processedAt: existingKey.createdAt
                };
            } else {
                console.warn(`Idempotency Conflict: Key ${idempotencyKey} leveraged with different payload.`);
                throw new AppError(
                    "Idempotency Key Usage Conflict: This key has already been used.",
                    "IDEMPOTENCY_CONFLICT",
                    409
                );
            }
        }
    }

    // WH-129: Multi-Date Validation
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayStr = formatter.format(new Date()); // "2025-01-21"

    // --- Optimization: Pre-pass to collect workers and date range for Batch Overlap Check ---
    const allWorkerIds = new Set<string>();
    let minDateStr = "";
    let maxDateStr = "";

    const invalidPastDates: string[] = [];

    // Pre-pass loop
    for (const block of schedules) {
        const effectiveDates = expandRecurringDates(block.dates, recurrence as RecurrenceConfig);

        for (const dateStr of effectiveDates) {
            // Track Min/Max Dates
            if (!minDateStr || dateStr < minDateStr) minDateStr = dateStr;
            if (!maxDateStr || dateStr > maxDateStr) maxDateStr = dateStr;

            if (dateStr < todayStr) {
                invalidPastDates.push(dateStr);
            }
        }

        for (const position of block.positions) {
            for (const wid of position.workerIds) {
                if (wid) allWorkerIds.add(wid);
            }
        }
    }

    if (invalidPastDates.length > 0) {
        const uniqueInvalid = [...new Set(invalidPastDates)];
        throw new AppError(
            `Cannot publish shifts in the past: ${uniqueInvalid.join(", ")}`,
            "INVALID_PAST_DATES",
            400
        );
    }

    // Fetch Existing Assignments in Batch
    const overlapMap = new Map<string, Array<{ startTime: Date; endTime: Date; title: string }>>();
    const availabilityMap = new Map<string, Array<{ startTime: Date; endTime: Date; type: string }>>();

    if (allWorkerIds.size > 0 && minDateStr && maxDateStr) {
        const uniqueWorkerIds = Array.from(allWorkerIds);

        // Conservative Buffer: search from start of first day to end of last day + 48h to cover overnight/timezones
        const searchStart = combineDateTimeTz(minDateStr, "00:00", timezone);
        const searchEnd = addDays(combineDateTimeTz(maxDateStr, "23:59", timezone), 2);


        const [existing, availabilityRecords] = await Promise.all([
            db.select({
                workerId: shiftAssignment.workerId,
                startTime: shift.startTime,
                endTime: shift.endTime,
                title: shift.title
            })
                .from(shiftAssignment)
                .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
                .where(and(
                    inArray(shiftAssignment.workerId, uniqueWorkerIds),
                    inArray(shiftAssignment.status, ['active', 'assigned', 'in-progress', 'completed', 'approved']),
                    eq(shift.organizationId, activeOrgId), // [SEC-CRITICAL] Scope to Org to prevent cross-tenant leak
                    lt(shift.startTime, searchEnd),
                    gt(shift.endTime, searchStart)
                )),

            db.query.workerAvailability.findMany({
                where: and(
                    inArray(workerAvailability.workerId, uniqueWorkerIds),
                    lt(workerAvailability.startTime, searchEnd),
                    gt(workerAvailability.endTime, searchStart)
                )
            })
        ]);

        // Group by Worker
        for (const record of existing) {
            if (!record.workerId) continue;
            const list = overlapMap.get(record.workerId) || [];
            list.push({ startTime: record.startTime, endTime: record.endTime, title: record.title });
            overlapMap.set(record.workerId, list);
        }

        // Group Availability
        for (const record of availabilityRecords) {
            if (!record.workerId) continue;
            const list = availabilityMap.get(record.workerId) || [];
            list.push({ startTime: record.startTime, endTime: record.endTime, type: record.type });
            availabilityMap.set(record.workerId, list);
        }
    }

    // 1. Prepare Data in Memory (Batch Strategy)
    const shiftsToInsert: typeof shift.$inferInsert[] = [];
    const assignmentsToInsert: typeof shiftAssignment.$inferInsert[] = [];

    // LOOP A: Iterate through Schedule Blocks

    for (const block of schedules) {

        // GROUPING: Generate a Layout Intent ID for this block ("Batch Context")
        // [ARCH-007] Decoupled: Always generate a fresh internal ID. Idempotency is handled via table.
        const scheduleIntentId = newId('int');

        // WH-130: Expand Dates
        const effectiveDates = expandRecurringDates(block.dates, recurrence as RecurrenceConfig);

        // LOOP B: Iterate through Dates
        for (const dateStr of effectiveDates) {


            // TIMEZONE FIX: Convert Local Wall Time -> UTC Timestamp
            const datePart = (dateStr.includes("T") ? dateStr.split("T")[0] : dateStr) || "";

            const startDateTime = combineDateTimeTz(datePart, block.startTime, timezone);
            let endDateTime = combineDateTimeTz(datePart, block.endTime, timezone);

            // Handle Overnight Shifts
            if (endDateTime < startDateTime) {
                // WH-104: Use addDays to respect DST transitions instead of fixed 24h minutes
                endDateTime = addDays(endDateTime, 1);
            }

            // LOOP C: Iterate through Positions
            for (const position of block.positions) {

                // LOOP D: Create Assignments and Link to Single Shift
                // SMART ID: Create Shift ID at Position Level
                const shiftId = newId('shf');
                const workerIds = position.workerIds;

                // Calculate capacity total (including nulls)
                const capacityTotal = workerIds.length;

                // Determine Shift Status
                const initialStatus = status === 'draft' ? 'draft' : 'published';

                shiftsToInsert.push({
                    id: shiftId,
                    organizationId: activeOrgId,
                    locationId,
                    contactId,
                    title: position.roleName,
                    description: block.scheduleName,
                    startTime: startDateTime,
                    endTime: endDateTime,
                    price: position.price || 0,
                    capacityTotal: capacityTotal,
                    status: initialStatus,
                    scheduleGroupId: scheduleIntentId
                });

                for (const workerId of workerIds) {
                    // Handle null workerId (Open Spot)
                    if (workerId) {
                        // WH-119: Concurrent Shift Prevention

                        // 1. Check Pre-fetched Existing Overlaps
                        const existingForWorker = overlapMap.get(workerId) || [];
                        // Overlap Logic: (StartA < EndB) and (EndA > StartB)
                        const dbConflict = existingForWorker.find(existing =>
                            existing.startTime < endDateTime && existing.endTime > startDateTime
                        );

                        if (dbConflict) {
                            throw new AppError(
                                `Worker ${workerId} has overlapping shift: ${dbConflict.title} (${dbConflict.startTime.toISOString()})`,
                                "OVERLAP_CONFLICT",
                                409
                            );
                        }

                        // [AVL-004] Check Availability
                        const workerAvailabilityFromDb = availabilityMap.get(workerId) || [];
                        const availabilityConflict = workerAvailabilityFromDb.find(a =>
                            a.type === 'unavailable' &&
                            a.startTime < endDateTime &&
                            a.endTime > startDateTime
                        );

                        if (availabilityConflict) {
                            throw new AppError(
                                `Worker ${workerId} is unavailable during this time`,
                                "AVAILABILITY_CONFLICT",
                                409
                            );
                        }

                        // 2. Check In-Memory Batch for overlap (Current Request)
                        // We iterate existing assignments.
                        for (const existingAssign of assignmentsToInsert) {
                            if (existingAssign.workerId === workerId) {
                                // Find sibling shift details (we need start/end time)
                                const siblingShift = shiftsToInsert.find(s => s.id === existingAssign.shiftId);
                                if (siblingShift) {
                                    if (siblingShift.startTime < endDateTime && siblingShift.endTime > startDateTime) {
                                        throw new AppError(
                                            `Worker ${workerId} is double-booked in this request: ${siblingShift.title}`,
                                            "OVERLAP_CONFLICT",
                                            409
                                        );
                                    }
                                }
                            }
                        }

                        assignmentsToInsert.push({
                            // SMART ID: Use 'asg' prefix
                            id: newId('asg'),
                            shiftId: shiftId,
                            workerId: workerId,
                            status: 'active',
                            budgetRateSnapshot: position.price || 0
                        });
                    }
                }
            }
        }
    }

    // WH-204: Fetch location name for notification body

    const locationRecord = await db.query.location.findFirst({
        where: eq(location.id, locationId),
        columns: { name: true }
    });
    const venueName = locationRecord?.name || 'the venue';

    // 2. Execute Batch Inserts (Atomic Transaction)

    // 2. Execute Batch Inserts (Atomic Transaction)
    const execute = async (tx: TxOrDb) => {

        if (shiftsToInsert.length > 0) {
            await tx.insert(shift).values(shiftsToInsert);

        }

        if (assignmentsToInsert.length > 0) {

            try {

                await tx.insert(shiftAssignment).values(assignmentsToInsert);

            } catch (e: any) {





                throw e;
            }
        }

        // [ARCH-007] Record Idempotency Key
        if (idempotencyKey) {
            await tx.insert(idempotencyKeyTable).values({
                key: idempotencyKey,
                organizationId: activeOrgId,
                hash: payloadHash,
                expiresAt: addDays(new Date(), 7) // 7 day retention for keys
            });

        }

        // WH-204: Schedule Notifications
        if (status === 'published' && assignmentsToInsert.length > 0) {


            // OPTIMIZATION: Bulk fetch preferences to avoid N+1 inside loop
            // Optimization for N+1: Collect all worker IDs
            const workerIdsForNotifs = Array.from(new Set(assignmentsToInsert.map(a => a.workerId).filter(Boolean))) as string[];

            const preferencesMap = new Map<string, any>(); // Using any to match the shape expected by buildNotificationSchedule which matches schema

            if (workerIdsForNotifs.length > 0) {

                const prefs = await db.query.workerNotificationPreferences.findMany({
                    where: inArray(workerNotificationPreferences.workerId, workerIdsForNotifs)
                });


                for (const p of prefs) {
                    preferencesMap.set(p.workerId, {
                        nightBeforeEnabled: p.nightBeforeEnabled ?? true,
                        sixtyMinEnabled: p.sixtyMinEnabled ?? true,
                        fifteenMinEnabled: p.fifteenMinEnabled ?? true,
                        shiftStartEnabled: p.shiftStartEnabled ?? true,
                        lateWarningEnabled: p.lateWarningEnabled ?? true,
                        quietHoursEnabled: p.quietHoursEnabled ?? false,
                        quietHoursStart: p.quietHoursStart,
                        quietHoursEnd: p.quietHoursEnd,
                    });
                }
            }

            const notificationsToInsert: typeof scheduledNotification.$inferInsert[] = [];

            for (const assignment of assignmentsToInsert) {
                if (!assignment.workerId) continue;

                const shiftData = shiftsToInsert.find(s => s.id === assignment.shiftId);
                if (!shiftData) continue;

                // Use cached prefs or default
                const userPrefs = preferencesMap.get(assignment.workerId) || {
                    nightBeforeEnabled: true,
                    sixtyMinEnabled: true,
                    fifteenMinEnabled: true,
                    shiftStartEnabled: true,
                    lateWarningEnabled: true,
                    quietHoursEnabled: false,
                    quietHoursStart: null,
                    quietHoursEnd: null
                };

                const schedule = await buildNotificationSchedule(
                    assignment.workerId,
                    assignment.shiftId,
                    activeOrgId,
                    shiftData.startTime as Date,
                    shiftData.title,
                    venueName,
                    userPrefs // INJECTED
                );


                notificationsToInsert.push(...schedule);
            }


            if (notificationsToInsert.length > 0) {
                // Batch insert in chunks of 100
                const CHUNK_SIZE = 100;
                for (let i = 0; i < notificationsToInsert.length; i += CHUNK_SIZE) {
                    const chunk = notificationsToInsert.slice(i, i + CHUNK_SIZE);

                    await tx.insert(scheduledNotification).values(chunk);
                }

            }
        }

    };

    try {
        if (tx) await execute(tx);
        else await db.transaction(execute);
    } catch (error) {

        if (error instanceof Error) {

        }
        throw error;
    }

    return {
        success: true,
        count: shiftsToInsert.length,
        message: `Successfully published ${shiftsToInsert.length} shifts.`
    };
};

// --- Helper Utilities ---

function combineDateTimeTz(dateStr: string, timeStr: string, timeZone: string): Date {
    // Construct local ISO string: "2025-12-30T09:00:00"
    // Note: timeStr must be "HH:mm"
    const localIso = `${dateStr}T${timeStr}:00`;
    // Convert to UTC Date object based on the timezone
    return fromZonedTime(localIso, timeZone);
}
