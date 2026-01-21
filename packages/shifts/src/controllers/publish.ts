import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { addMinutes, addDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { AppError } from "@repo/observability";
import { newId } from "../utils/ids";
import { findOverlappingAssignment } from "../services/overlap";
import { expandRecurringDates, RecurrenceConfig } from "../utils/recurrence";

import { z } from "zod";

// Rate Limiting (In-Memory for MVP)
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

const PublishSchema = z.object({
    idempotencyKey: z.string().optional(), // WH-110: Allow client to pass unique key
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

export const publishScheduleController = async (req: Request, headerOrgId: string): Promise<Response> => {
    // WH-111: Rate Limiting
    const now = Date.now();
    const record = rateLimitMap.get(headerOrgId) || { count: 0, windowStart: now };

    if (now - record.windowStart > RATE_LIMIT_WINDOW) {
        record.count = 1;
        record.windowStart = now;
    } else {
        record.count++;
    }
    rateLimitMap.set(headerOrgId, record);

    if (record.count > MAX_REQUESTS) {
        throw new AppError("Rate limit exceeded. Please try again later.", "RATE_LIMIT_EXCEEDED", 429, {
            retryAfter: Math.ceil((record.windowStart + RATE_LIMIT_WINDOW - now) / 1000)
        });
    }

    const body = await req.json();
    const parseResult = PublishSchema.safeParse(body);

    if (!parseResult.success) {
        throw new AppError("Validation Failed", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const { idempotencyKey, locationId, contactId, organizationId, timezone, status, schedules, recurrence } = parseResult.data;

    console.log("DEBUG: publishScheduleController received:", { status, schedulesCount: schedules.length, activeOrgId: headerOrgId, recurrenceEnabled: recurrence?.enabled });

    // Security Check: Header vs Body
    if (organizationId && organizationId !== headerOrgId) {
        throw new AppError("Organization mismatch", "FORBIDDEN", 403);
    }
    // Force use of header-derived orgId
    const activeOrgId = headerOrgId;

    // WH-110: Idempotency Check
    // If client provided a key, check if we already processed it.
    // We check if any shift exists with this scheduleGroupId.
    if (idempotencyKey) {
        const existingBatch = await db.query.shift.findFirst({
            where: and(
                eq(shift.organizationId, activeOrgId),
                eq(shift.scheduleGroupId, idempotencyKey)
            ),
            columns: { id: true, createdAt: true }
        });

        if (existingBatch) {
            console.log(`Idempotency hit for key: ${idempotencyKey}`);
            return Response.json({
                success: true,
                message: "Batch already processed (Idempotent)",
                batchId: idempotencyKey,
                processedAt: existingBatch.createdAt
            }, { status: 200 });
        }
    }

    // WH-129: Multi-Date Validation
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayStr = formatter.format(new Date()); // "2025-01-21"

    const invalidPastDates: string[] = [];
    for (const block of schedules) {
        // WH-130: Recurrence Expansion
        // We expand dates here primarily for VALIDATION?
        // Actually, we should validate the *expanded* dates too?
        // Or should we only validate the explicitly provided start dates?
        // Ideally, if a recurrence generates a past date, it should probably be skipped or errored.
        // Let's expand first.

        const effectiveDates = expandRecurringDates(block.dates, recurrence as RecurrenceConfig);

        for (const dateStr of effectiveDates) {
            if (dateStr < todayStr) {
                invalidPastDates.push(dateStr);
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

    // 1. Prepare Data in Memory (Batch Strategy)
    const shiftsToInsert: typeof shift.$inferInsert[] = [];
    const assignmentsToInsert: typeof shiftAssignment.$inferInsert[] = [];

    // LOOP A: Iterate through Schedule Blocks
    for (const block of schedules) {

        // GROUPING: Generate a Layout Intent ID for this block ("Batch Context")
        // WH-110: Use idempotencyKey if provided (shared across blocks? No, usually idempotency key represents the whole request)
        // If we use idempotencyKey as scheduleGroupId, all blocks in this request get same ID.
        // That matches our "Batch" concept.
        const scheduleIntentId = idempotencyKey || newId('int');

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
                // If any worker is assigned, shift is 'published' or 'assigned'.
                // If no workers (all null), it's still 'published' (open slots) unless whole thing is draft.
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
                        // 1. Check DB for overlap
                        const dbConflict = await findOverlappingAssignment({
                            workerId,
                            startTime: startDateTime,
                            endTime: endDateTime
                        });

                        if (dbConflict) {
                            throw new AppError(
                                `Worker ${workerId} has overlapping shift: ${dbConflict.title} (${dbConflict.startTime.toISOString()})`,
                                "OVERLAP_CONFLICT",
                                409
                            );
                        }

                        // 2. Check In-Memory Batch for overlap
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
                            status: 'active'
                        });
                    }
                }
            }
        }
    }

    // 2. Execute Batch Inserts (Atomic Transaction)
    await db.transaction(async (tx) => {
        if (shiftsToInsert.length > 0) {
            await tx.insert(shift).values(shiftsToInsert);
        }

        if (assignmentsToInsert.length > 0) {
            await tx.insert(shiftAssignment).values(assignmentsToInsert);
        }
    });

    return Response.json({
        success: true,
        count: shiftsToInsert.length,
        message: `Successfully published ${shiftsToInsert.length} shifts.`
    }, { status: 201 });
};

// --- Helper Utilities ---

function combineDateTimeTz(dateStr: string, timeStr: string, timeZone: string): Date {
    // Construct local ISO string: "2025-12-30T09:00:00"
    // Note: timeStr must be "HH:mm"
    const localIso = `${dateStr}T${timeStr}:00`;
    // Convert to UTC Date object based on the timezone
    return fromZonedTime(localIso, timeZone);
}
