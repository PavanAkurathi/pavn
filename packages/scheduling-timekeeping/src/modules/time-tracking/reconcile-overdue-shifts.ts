import { differenceInMinutes } from "date-fns";
import { and, eq, inArray, isNotNull, isNull, lte } from "drizzle-orm";

import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";

const ACTIVE_SHIFT_STATUSES = ["published", "assigned", "in-progress"] as const;
const CLOSED_ASSIGNMENT_STATUSES = new Set(["completed", "approved", "no_show", "removed"]);

function toOrgIds(orgScope: string | string[]) {
    return Array.isArray(orgScope) ? orgScope.filter(Boolean) : [orgScope];
}

export async function reconcileOverdueShiftState(orgScope: string | string[], now = new Date()) {
    const orgIds = toOrgIds(orgScope);

    if (orgIds.length === 0) {
        return;
    }

    const overdueAssignments = await db
        .select({
            assignmentId: shiftAssignment.id,
            breakMinutes: shiftAssignment.breakMinutes,
            actualClockIn: shiftAssignment.actualClockIn,
            needsReview: shiftAssignment.needsReview,
            reviewReason: shiftAssignment.reviewReason,
            shiftId: shift.id,
            scheduledEnd: shift.endTime,
        })
        .from(shiftAssignment)
        .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
        .where(and(
            inArray(shift.organizationId, orgIds),
            inArray(shift.status, [...ACTIVE_SHIFT_STATUSES]),
            lte(shift.endTime, now),
            isNotNull(shiftAssignment.actualClockIn),
            isNull(shiftAssignment.actualClockOut),
        ));

    if (overdueAssignments.length > 0) {
        await Promise.all(
            overdueAssignments.map((row) => {
                const totalDurationMinutes = Math.max(
                    0,
                    differenceInMinutes(row.scheduledEnd, row.actualClockIn!) - (row.breakMinutes || 0),
                );

                return db.update(shiftAssignment)
                    .set({
                        actualClockOut: row.scheduledEnd,
                        effectiveClockOut: row.scheduledEnd,
                        totalDurationMinutes,
                        clockOutMethod: "system_auto_finalized",
                        clockOutVerified: false,
                        needsReview: true,
                        reviewReason: row.reviewReason ?? "no_clockout",
                        status: "completed",
                        updatedAt: now,
                    })
                    .where(and(
                        eq(shiftAssignment.id, row.assignmentId),
                        isNull(shiftAssignment.actualClockOut),
                    ));
            }),
        );
    }

    const overdueShifts = await db.query.shift.findMany({
        where: and(
            inArray(shift.organizationId, orgIds),
            inArray(shift.status, [...ACTIVE_SHIFT_STATUSES]),
            lte(shift.endTime, now),
        ),
        with: {
            assignments: true,
        },
    });

    const shiftsReadyForCompletion = overdueShifts.filter((record) => {
        const activeAssignments = record.assignments.filter((assignment) => assignment.status !== "removed");

        if (activeAssignments.length === 0) {
            return true;
        }

        return activeAssignments.every((assignment) =>
            assignment.actualClockOut !== null || assignment.effectiveClockOut !== null || CLOSED_ASSIGNMENT_STATUSES.has(assignment.status),
        );
    });

    if (shiftsReadyForCompletion.length > 0) {
        await Promise.all(
            shiftsReadyForCompletion.map((record) =>
                db.update(shift)
                    .set({
                        status: "completed",
                        updatedAt: now,
                    })
                    .where(and(
                        eq(shift.id, record.id),
                        inArray(shift.status, [...ACTIVE_SHIFT_STATUSES]),
                    )),
            ),
        );
    }
}
