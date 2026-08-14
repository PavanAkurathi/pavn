import { db } from "@repo/database";
import { shift, shiftAssignment, location } from "@repo/database/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@repo/observability";
import { newId } from "../../utils/ids";
import {
    addDaysToLocalDate,
    combineDateTimeTz,
    localDateInZone,
    localTimeInZone,
} from "../../utils/zoned-time";

const CopyWeekSchema = z.object({
    locationId: z.string(),
    /** Local calendar date (YYYY-MM-DD) of the first day of the week being filled. */
    targetWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
});

const DAYS_IN_WEEK = 7;
/** Assignments to a temp/agency worker are a one-off booking, not a standing arrangement. */
const isCarriedOver = (assignment: { workerId: string | null; rosterEntryId: string | null }) =>
    Boolean(assignment.workerId || assignment.rosterEntryId);

/**
 * Refill a week from the one before it.
 *
 * Copies the *shape* of last week — same weekday, same wall-clock times, same
 * roles and headcount — plus the roster workers who were on it. Agency workers
 * are left as open slots: they were booked by name for one night, not signed up
 * for a recurring pattern.
 *
 * Everything lands as `draft`. Copying a week should not notify anyone; the
 * manager reviews it and publishes when it is right.
 *
 * Days that already have shifts are left untouched, so running this twice does
 * not double the week.
 */
export const copyWeek = async (body: unknown, orgId: string) => {
    const parsed = CopyWeekSchema.safeParse(body);
    if (!parsed.success) {
        throw new AppError("Validation failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const { locationId, targetWeekStart } = parsed.data;

    const locationRecord = await db.query.location.findFirst({
        where: and(eq(location.id, locationId), eq(location.organizationId, orgId)),
        columns: { id: true, timezone: true },
    });

    if (!locationRecord) {
        throw new AppError("Location not found", "NOT_FOUND", 404);
    }

    const timezone = locationRecord.timezone;
    if (!timezone) {
        throw new AppError(
            "This location has no timezone set, so its shifts cannot be copied.",
            "VALIDATION_ERROR",
            400,
        );
    }

    // Week boundaries are local midnights, converted to instants in the
    // location's zone — not UTC midnights, which would slice the week apart
    // for anywhere east or west of Greenwich.
    const sourceWeekStart = addDaysToLocalDate(targetWeekStart, -DAYS_IN_WEEK);
    const sourceStart = combineDateTimeTz(sourceWeekStart, "00:00", timezone);
    const sourceEnd = combineDateTimeTz(targetWeekStart, "00:00", timezone);
    const targetEnd = combineDateTimeTz(addDaysToLocalDate(targetWeekStart, DAYS_IN_WEEK), "00:00", timezone);

    const [sourceShifts, targetShifts] = await Promise.all([
        db.query.shift.findMany({
            where: and(
                eq(shift.organizationId, orgId),
                eq(shift.locationId, locationId),
                gte(shift.startTime, sourceStart),
                lt(shift.startTime, sourceEnd),
            ),
            with: { assignments: true },
        }),
        db.query.shift.findMany({
            where: and(
                eq(shift.organizationId, orgId),
                eq(shift.locationId, locationId),
                gte(shift.startTime, sourceEnd),
                lt(shift.startTime, targetEnd),
            ),
            columns: { id: true, startTime: true },
        }),
    ]);

    if (sourceShifts.length === 0) {
        return { copied: 0, skippedDays: [], sourceWeekStart, message: "Nothing scheduled last week to copy." };
    }

    const occupiedDays = new Set(
        targetShifts.map((existing) => localDateInZone(existing.startTime, timezone)),
    );

    const scheduleGroupId = newId("int");
    const newShifts: Array<typeof shift.$inferInsert> = [];
    const newAssignments: Array<typeof shiftAssignment.$inferInsert> = [];
    const skippedDays = new Set<string>();

    for (const source of sourceShifts) {
        // A shift that was called off is not part of the week's shape. Copying
        // it would quietly put back work the manager already cancelled.
        if (source.status === "cancelled") continue;

        const sourceDate = localDateInZone(source.startTime, timezone);
        const targetDate = addDaysToLocalDate(sourceDate, DAYS_IN_WEEK);

        if (occupiedDays.has(targetDate)) {
            skippedDays.add(targetDate);
            continue;
        }

        // Re-derived from the wall clock rather than by adding 7*24h, so a
        // 09:00 shift copied across a DST change is still 09:00.
        const startTime = combineDateTimeTz(targetDate, localTimeInZone(source.startTime, timezone), timezone);
        const endDateSource = localDateInZone(source.endTime, timezone);
        const overnight = endDateSource !== sourceDate;
        const endTime = combineDateTimeTz(
            overnight ? addDaysToLocalDate(targetDate, 1) : targetDate,
            localTimeInZone(source.endTime, timezone),
            timezone,
        );

        const newShiftId = newId("shf");
        newShifts.push({
            id: newShiftId,
            organizationId: orgId,
            locationId,
            contactId: source.contactId,
            title: source.title,
            description: source.description,
            startTime,
            endTime,
            timezone,
            capacityTotal: source.capacityTotal,
            status: "draft",
            scheduleGroupId,
        });

        for (const assignment of source.assignments ?? []) {
            if (assignment.status === "removed" || !isCarriedOver(assignment)) continue;
            newAssignments.push({
                id: newId("asg"),
                shiftId: newShiftId,
                workerId: assignment.workerId,
                rosterEntryId: assignment.rosterEntryId,
                status: "active",
            });
        }
    }

    if (newShifts.length === 0) {
        return {
            copied: 0,
            skippedDays: [...skippedDays].sort(),
            sourceWeekStart,
            // Nothing skipped means the source week held nothing worth copying —
            // cancelled shifts, most likely — not that the target is full.
            message: skippedDays.size > 0
                ? "Every day of that week already has shifts."
                : "Nothing scheduled last week to copy.",
        };
    }

    await db.transaction(async (tx) => {
        await tx.insert(shift).values(newShifts);
        if (newAssignments.length > 0) {
            await tx.insert(shiftAssignment).values(newAssignments);
        }
    });

    return {
        copied: newShifts.length,
        assignmentsCopied: newAssignments.length,
        skippedDays: [...skippedDays].sort(),
        sourceWeekStart,
        scheduleGroupId,
    };
};
