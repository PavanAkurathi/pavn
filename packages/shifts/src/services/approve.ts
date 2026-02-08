// packages/shifts/src/services/approve.ts

import { db, TxOrDb } from "@repo/database";
import { shift, shiftAssignment, organization, member } from "@repo/database/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { logAudit, AppError } from "@repo/observability";
import { differenceInMinutes, addMinutes } from "date-fns";
import { calculateShiftPay } from "../utils/calculations";
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

        if (!memberRecord || !['admin', 'manager', 'owner'].includes(memberRecord.role)) {
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
            estimatedCostCents: number;
            budgetRateSnapshot: number | null;
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
                    estimatedCostCents: 0,
                    budgetRateSnapshot: null,
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
                    estimatedCostCents: calculateShiftPay(
                        Math.max(0, differenceInMinutes(scheduledEnd, new Date(assign.actualClockIn)) - (assign.breakMinutes || 0)),
                        shiftRecord.price || 0
                    ),
                    budgetRateSnapshot: shiftRecord.price || 0,
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
                // If worker clocks out slightly early (within 5 mins of end), pay them until scheduled end.
                // Logic: if actualClockOut >= (scheduledEnd - 5m) -> effectiveEnd = scheduledEnd
                // Note: We also cap at scheduledEnd usually? Or do we pay OT? 
                // Current logic seems to just use difference.
                // Requirement says "Snap effectiveEnd to scheduledEnd if worker clocks out within the grace window".
                // Assuming this means "snap UP" to scheduled end.
                const earlyGraceThreshold = addMinutes(scheduledEnd, -END_GRACE_PERIOD);
                const useScheduledEnd = actualClockOut >= earlyGraceThreshold; // If they left within 5 mins of end (or later)

                const effectiveEnd = useScheduledEnd ? scheduledEnd : actualClockOut;

                // If they stayed LATE, effectiveEnd is scheduledEnd per "snap" logic? 
                // User requirement: "Snap effectiveEnd to scheduledEnd if the worker clocks out within the grace window"
                // Usually this means "don't penalize early leave". But if they stay late, we usually pay them (OT).
                // Let's refine: The request specifically says "payroll logic... docks pay for actualClockOut even if it is 1 minute early".
                // So we want to PREVENT docking.
                // Case 1: 5:00 PM end. Clock out 4:58 PM. -> Pay until 5:00 PM.
                // Case 2: 5:00 PM end. Clock out 5:15 PM. -> Pay until 5:15 PM (unless specific overtime rules, but base requirement implies fixing the early penalty).
                // If useScheduledEnd is true, we snap to scheduledEnd.
                // Wait: if actualClockOut is 5:15 PM, that is > earlyGraceThreshold (4:55). So useScheduledEnd=true -> Snap to 5:00 PM.
                // This would effectively KILL overtime pay if we blindly snap.
                // We should only snap if `actualClockOut < scheduledEnd`.

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

                // [FIN-002] Rate Lock: Use snapshot, fallback to shift price
                let rate = assign.budgetRateSnapshot;
                if (rate === null || rate === undefined) {
                    // Log warning (using console for now, or logAudit if possible, but keep it simple)
                    console.warn(`[RateLock] Missing snapshot for assignment ${assign.id}. Fallback to shift price.`);
                    rate = shiftRecord.price || 0;
                }

                // WH-137: Centralized Pay Calculation
                const pay = calculateShiftPay(billableMinutes, rate);

                let note: string | null = null;
                // scheduledEnd already defined above
                if (differenceInMinutes(actualClockOut, scheduledEnd) > 15) {
                    note = "Flag: Clock-out >15m past schedule";
                }

                updates.push({
                    id: assign.id,
                    status: 'completed',
                    estimatedCostCents: pay,
                    budgetRateSnapshot: rate,
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
            // Option 1: Promise.all for concurrency (Drizzle doesn't support bulk update with different values easily yet without CASE)
            // For readability and safety, Promise.all inside transaction is efficient enough vs sequential wait
            await Promise.all(updates.map(u =>
                tx.update(shiftAssignment)
                    .set({
                        status: u.status,
                        estimatedCostCents: u.estimatedCostCents,
                        budgetRateSnapshot: u.budgetRateSnapshot,
                        breakMinutes: u.breakMinutes,
                        ...(u.effectiveClockIn ? { effectiveClockIn: u.effectiveClockIn } : {}),
                        ...(u.effectiveClockOut ? { effectiveClockOut: u.effectiveClockOut } : {}),
                        // Note: actualClockIn/Out are NOT updated here (they are source)
                        // Note: managerVerifiedIn/Out are NOT updated here (requires manual manager override, this is systematic approval)
                        updatedAt: new Date() // Add updated_at here or ensure default updates
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
                totalCostCents: updates.reduce((acc, u) => acc + u.estimatedCostCents, 0)
            }
        });

        // Batch Audit: No Shows
        // Collecting No Shows for a single batch log or looping (Audit service might not support batch yet)
        // Keeping loop for No Show audits as they are rare entities, but preventing N+1 for the main flow
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
