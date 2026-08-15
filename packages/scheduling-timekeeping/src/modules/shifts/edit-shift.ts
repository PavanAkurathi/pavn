// packages/scheduling-timekeeping/src/modules/shifts/edit-shift.ts

import { db } from "@repo/database";
import { shift, shiftAssignment, location, scheduledNotification } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@repo/database";
import { AppError } from "@repo/observability";
import { buildNotificationSchedule } from "@repo/notifications";
import { combineDateTimeTz, addDaysToLocalDate } from "../../utils/zoned-time";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const EditShiftSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    /**
     * Wall-clock alternative to the ISO pair above. The times a manager types
     * are the times at the site, so the conversion to an instant belongs here,
     * next to the shift's timezone — not in a browser sitting in another one.
     */
    local: z
        .object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
            startTime: z.string().regex(HHMM, "Expected HH:MM"),
            endTime: z.string().regex(HHMM, "Expected HH:MM"),
        })
        .optional(),
    capacityTotal: z.number().int().min(1).max(500).optional(),
    locationId: z.string().optional().nullable(),
    contactId: z.string().optional().nullable(),
});

export const editShift = async (
    shiftId: string,
    orgId: string,
    managerId: string,
    data: unknown
) => {
    // 1. Validate input
    const parseResult = EditShiftSchema.safeParse(data);
    if (!parseResult.success) {
        throw new AppError("Invalid input", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const updates = parseResult.data;

    // 2. Fetch existing shift with org ownership check
    const existing = await db.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
    });

    if (!existing) {
        throw new AppError("Shift not found", "SHIFT_NOT_FOUND", 404);
    }

    // 3. Only editable in certain statuses
    const editableStatuses = ['draft', 'published', 'assigned'];
    if (!editableStatuses.includes(existing.status)) {
        throw new AppError(
            `Cannot edit shift in '${existing.status}' status`,
            "INVALID_STATE",
            409
        );
    }

    // 3b. Moving a shift to another location moves its clock with it. The
    // location owns the timezone, so a shift that lands in Phoenix must stop
    // being stamped as Boston or every reading of it afterwards is wrong.
    let nextTimezone = existing.timezone;
    if (updates.locationId && updates.locationId !== existing.locationId) {
        const destination = await db.query.location.findFirst({
            where: and(eq(location.id, updates.locationId), eq(location.organizationId, orgId)),
            columns: { id: true, timezone: true },
        });

        if (!destination) {
            throw new AppError("Location not found", "NOT_FOUND", 404);
        }
        if (destination.timezone) {
            nextTimezone = destination.timezone;
        }
    }

    // 4. Resolve the new times. Wall-clock input wins when given, since it is
    // what the manager actually typed.
    let resolvedStart: Date | undefined;
    let resolvedEnd: Date | undefined;

    if (updates.local) {
        const zone = nextTimezone;
        if (!zone) {
            throw new AppError(
                "This shift has no timezone, so wall-clock times cannot be placed.",
                "VALIDATION_ERROR",
                400,
            );
        }

        resolvedStart = combineDateTimeTz(updates.local.date, updates.local.startTime, zone);
        resolvedEnd = combineDateTimeTz(
            // An end at or before the start means it runs past midnight.
            updates.local.endTime <= updates.local.startTime
                ? addDaysToLocalDate(updates.local.date, 1)
                : updates.local.date,
            updates.local.endTime,
            zone,
        );
    } else {
        resolvedStart = updates.startTime ? new Date(updates.startTime) : undefined;
        resolvedEnd = updates.endTime ? new Date(updates.endTime) : undefined;
    }

    const newStart = resolvedStart ?? existing.startTime;
    const newEnd = resolvedEnd ?? existing.endTime;

    if (newEnd <= newStart) {
        throw new AppError("End time must be after start time", "VALIDATION_ERROR", 400);
    }

    // 5. If reducing capacity, check against current assignment count
    if (updates.capacityTotal !== undefined) {
        const assignmentCount = await db.query.shiftAssignment.findMany({
            where: and(
                eq(shiftAssignment.shiftId, shiftId),
                eq(shiftAssignment.status, "active")
            ),
            columns: { id: true },
        });

        if (updates.capacityTotal < assignmentCount.length) {
            throw new AppError(
                `Cannot reduce capacity to ${updates.capacityTotal} — ${assignmentCount.length} workers already assigned`,
                "CAPACITY_CONFLICT",
                409
            );
        }
    }

    // 6. Build update set (only changed fields)
    const updateSet: Record<string, any> = { updatedAt: new Date() };

    if (updates.title !== undefined) updateSet.title = updates.title;
    if (updates.description !== undefined) updateSet.description = updates.description;
    if (resolvedStart !== undefined) updateSet.startTime = resolvedStart;
    if (resolvedEnd !== undefined) updateSet.endTime = resolvedEnd;
    if (updates.capacityTotal !== undefined) updateSet.capacityTotal = updates.capacityTotal;
    if (updates.locationId !== undefined) updateSet.locationId = updates.locationId;
    if (updates.contactId !== undefined) updateSet.contactId = updates.contactId;
    if (nextTimezone !== existing.timezone) updateSet.timezone = nextTimezone;

    // 7. Apply update
    const [updated] = await db.update(shift)
        .set(updateSet)
        .where(eq(shift.id, shiftId))
        .returning();

    // 8. Audit log
    await logAudit({
        action: "SHIFT_EDITED",
        entityType: "shift",
        entityId: shiftId,
        actorId: managerId,
        organizationId: orgId,
        metadata: {
            changes: updates,
            previousStartTime: existing.startTime?.toISOString(),
            previousEndTime: existing.endTime?.toISOString(),
        },
    });

    // 9. Tell the people it affects.
    //
    // Moving a shift silently is the worst thing this function could do: the
    // worker turns up at the hour they were told and the hour is wrong. Only
    // app users can be reached — invited and agency workers have no device —
    // so the count comes back for the UI to say who still needs a phone call.
    const timeChanged =
        newStart.getTime() !== existing.startTime.getTime() ||
        newEnd.getTime() !== existing.endTime.getTime();
    const locationChanged = updates.locationId !== undefined && updates.locationId !== existing.locationId;

    let notified = 0;
    let unreachable = 0;

    if ((timeChanged || locationChanged) && existing.status !== "draft") {
        const assignments = await db.query.shiftAssignment.findMany({
            where: and(eq(shiftAssignment.shiftId, shiftId), eq(shiftAssignment.status, "active")),
            columns: { workerId: true },
        });

        const workerIds = assignments.map((a) => a.workerId).filter(Boolean) as string[];
        unreachable = assignments.length - workerIds.length;

        if (workerIds.length > 0) {
            const venue = await db.query.location.findFirst({
                where: eq(location.id, updateSet.locationId ?? existing.locationId ?? ""),
                columns: { name: true },
            });

            const rows: (typeof scheduledNotification.$inferInsert)[] = [];
            for (const workerId of workerIds) {
                rows.push(
                    ...(await buildNotificationSchedule(
                        workerId,
                        shiftId,
                        orgId,
                        newStart,
                        updateSet.title ?? existing.title,
                        venue?.name || "the venue",
                    )),
                );
            }

            if (rows.length > 0) {
                // The old reminders point at the hour this shift no longer
                // starts, so they go before the new ones land.
                await db
                    .delete(scheduledNotification)
                    .where(
                        and(
                            eq(scheduledNotification.shiftId, shiftId),
                            eq(scheduledNotification.status, "pending"),
                        ),
                    );
                await db.insert(scheduledNotification).values(rows);
            }

            notified = workerIds.length;
        }
    }

    return {
        success: true,
        shift: updated,
        timeChanged,
        locationChanged,
        notified,
        unreachable,
    };
};
