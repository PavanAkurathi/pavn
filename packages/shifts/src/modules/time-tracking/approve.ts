// packages/shifts/src/services/approve.ts

import { db, TxOrDb } from "@repo/database";
import { shift, shiftAssignment, organization, member } from "@repo/database/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { logAudit, AppError } from "@repo/observability";
import { differenceInMinutes, addMinutes } from "date-fns";
import { validateShiftTransition, ShiftStatus } from "@repo/config";

export const approveShift = async (shiftId: string, orgId: string, actorId: string, tx?: TxOrDb) => {
    // 1. Get Shift & Assignments
    const execute = async (tx: TxOrDb) => {
        // [SEC-003] Internal Actor Permission Validation
        const memberRecord = await tx.query.member.findFirst({
            where: and(
                eq(member.organizationId, orgId),
                eq(member.userId, actorId)
            ),
            columns: { role: true }
        });

        if (!memberRecord || memberRecord.role !== 'admin') {
            throw new AppError("Insufficient permissions to approve shifts", "FORBIDDEN", 403);
        }

        const shiftRecord = await tx.query.shift.findFirst({
            where: and(
                eq(shift.id, shiftId),
                eq(shift.organizationId, orgId)
            ),
            with: {
                assignments: true
            }
        });

        if (!shiftRecord) {
            throw new AppError("Shift not found", "SHIFT_NOT_FOUND", 404);
        }

        // Validate Transition
        try {
            validateShiftTransition(shiftRecord.status as ShiftStatus, 'approved');
        } catch (e) {
            if (e instanceof Error) {
                throw new AppError(e.message, "INVALID_TRANSITION", 400);
            }
            throw e;
        }

        // 2. Audit Assignments
        const dirtyAssignments: string[] = [];
        const updates: {
            id: string;
            status: "no_show" | "completed";
            totalDurationMinutes: number; // Only time
            breakMinutes: number;
            workerId: string; // Needed for audit
            effectiveClockIn?: Date;
            effectiveClockOut?: Date;
            clockOutMethod?: string; // Metadata ONLY, not column
        }[] = [];

        for (const assign of shiftRecord.assignments) {
            // CASE: No Show (Empty times)
            if (!assign.actualClockIn && !assign.actualClockOut) {
                updates.push({
                    id: assign.id,
                    status: 'no_show',
                    totalDurationMinutes: 0,
                    breakMinutes: 0,
                    workerId: assign.workerId
                });
                continue;
            }

            // CASE: Missing Clock Out (Auto-Fix)
            if (assign.actualClockIn && !assign.actualClockOut) {
                const scheduledEnd = new Date(shiftRecord.endTime);

                updates.push({
                    id: assign.id,
                    status: 'completed',
                    totalDurationMinutes: Math.max(0, differenceInMinutes(scheduledEnd, new Date(assign.actualClockIn)) - (assign.breakMinutes || 0)),
                    breakMinutes: assign.breakMinutes || 0,
                    workerId: assign.workerId,
                    effectiveClockIn: assign.actualClockIn,
                    effectiveClockOut: scheduledEnd,
                    clockOutMethod: 'system_auto_finalized'
                });
                continue;
            }

            // CASE: Valid (Calculate Pay)
            if (assign.actualClockIn && assign.actualClockOut) {
                const scheduledStart = new Date(shiftRecord.startTime);
                const scheduledEnd = new Date(shiftRecord.endTime);
                const actualClockIn = new Date(assign.actualClockIn);
                const actualClockOut = new Date(assign.actualClockOut);

                const START_GRACE_PERIOD = 5; // Minutes to snap start time
                const END_GRACE_PERIOD = 5; // [FIN-004] Minutes to snap end time

                const useScheduledStart = actualClockIn <= addMinutes(scheduledStart, START_GRACE_PERIOD);
                const effectiveStart = useScheduledStart ? scheduledStart : actualClockIn;

                // [FIN-004] Symmetric Grace Period for Clock Out
                const earlyGraceThreshold = addMinutes(scheduledEnd, -END_GRACE_PERIOD);
                const useScheduledEnd = actualClockOut >= earlyGraceThreshold; // If they left within 5 mins of end (or later)

                // Snap logic: if checked out >= 4:55 for a 5:00 shift, we snap to 5:00 IF accurate.
                // But we also want to avoid overpaying if they left WAY later?
                // Logic: If they left >= 4:55 AND <= 5:00 -> Snap to 5:00.
                // If they left > 5:00 -> Use actual (pay OT).
                // Wait, previous logic was: if actualClockOut >= earlyGraceThreshold -> useScheduledEnd -> effectiveEnd = scheduledEnd.
                // If actualClockOut is 5:30, useScheduledEnd is TRUE. effectiveEnd becomes 5:00. This KILLS OT.
                // Let's preserve the logic I analyzed in planning:
                // Only snap to scheduledEnd if actualClockOut < scheduledEnd.

                let calculatedEnd = actualClockOut;
                if (actualClockOut < scheduledEnd && actualClockOut >= earlyGraceThreshold) {
                    calculatedEnd = scheduledEnd;
                }

                const totalMinutes = differenceInMinutes(calculatedEnd, effectiveStart);

                if (totalMinutes < 0) {
                    dirtyAssignments.push(assign.workerId);
                    continue;
                }

                const breakMinutes = assign.breakMinutes || 0;

                if (breakMinutes < 0 || breakMinutes >= totalMinutes) {
                    dirtyAssignments.push(assign.workerId);
                    continue;
                }

                const billableMinutes = Math.max(0, totalMinutes - breakMinutes);

                // REMOVED: Rate validation and Cost Calculation (TICKET-003)

                let note: string | null = null;
                // scheduledEnd already defined above
                if (differenceInMinutes(actualClockOut, scheduledEnd) > 15) {
                    note = "Flag: Clock-out >15m past schedule";
                }

                updates.push({
                    id: assign.id,
                    status: 'completed',
                    totalDurationMinutes: billableMinutes,
                    breakMinutes: breakMinutes,
                    workerId: assign.workerId,
                    effectiveClockIn: effectiveStart,
                    effectiveClockOut: calculatedEnd
                });
            }
        }

        // 3. Block if Dirty
        if (dirtyAssignments.length > 0) {
            throw new AppError("Cannot approve: Workers missing clock-out times.", "DIRTY_DATA", 409, { workerIds: dirtyAssignments });
        }

        // 5. Commit Changes (WH-139: Batch Operations)
        if (updates.length > 0) {
            await Promise.all(updates.map(u =>
                tx.update(shiftAssignment)
                    .set({
                        status: u.status,
                        totalDurationMinutes: u.totalDurationMinutes,
                        // REMOVED: payoutAmountCents, budgetRateSnapshot (TICKET-003)
                        breakMinutes: u.breakMinutes,
                        ...(u.effectiveClockIn ? { effectiveClockIn: u.effectiveClockIn } : {}),
                        ...(u.effectiveClockOut ? { effectiveClockOut: u.effectiveClockOut } : {}),
                        updatedAt: new Date()
                    })
                    .where(eq(shiftAssignment.id, u.id))
            ));
        }

        const res = await tx.update(shift)
            .set({ status: 'approved' })
            .where(and(
                eq(shift.id, shiftId),
                eq(shift.status, 'completed')
            ));

        if (res.rowCount === 0) {
            throw new AppError("Race condition: Shift was modified or approved by another request.", "RACE_CONDITION", 409);
        }

        // Batch Audit: Single Shift Approved Log
        await logAudit({
            action: 'shift.approved',
            entityType: 'shift',
            entityId: shiftId,
            organizationId: orgId,
            userId: actorId,
            metadata: {
                approvedAssignmentsCount: updates.length,
                // REMOVED: totalCostCents (TICKET-003)
            }
        });

        // Batch Audit: No Shows
        const noShows = updates.filter(u => u.status === 'no_show');
        if (noShows.length > 0) {
            await Promise.all(noShows.map(u =>
                logAudit({
                    action: 'assignment.no_show',
                    entityType: 'shift_assignment',
                    entityId: u.id,
                    organizationId: orgId,
                    userId: actorId, // The manager/system acting
                    targetUserId: u.workerId, // The worker being marked as no-show
                    metadata: {
                        shiftId: shiftId,
                        reason: 'No clock-in/out recorded at approval'
                    }
                })
            ));
        }

        return { success: true };
    };

    if (tx) return execute(tx);
    return db.transaction(execute);
};
