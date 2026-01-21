// packages/shifts/src/controllers/approve.ts

import { db } from "@repo/database";
import { shift, shiftAssignment, organization, member } from "@repo/database/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logAudit, logShiftChange, AppError } from "@repo/observability";
import { differenceInMinutes, addMinutes } from "date-fns";

import { validateShiftTransition, ShiftStatus } from "@repo/config";

export const approveShiftController = async (shiftId: string, orgId: string) => {
    // 1. Get Shift & Assignments
    const result = await db.transaction(async (tx) => {
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

        // WH-009: Validate Transition
        try {
            validateShiftTransition(shiftRecord.status as ShiftStatus, 'approved');
        } catch (e) {
            if (e instanceof Error) {
                throw new AppError(e.message, "INVALID_TRANSITION", 400);
            }
            throw e;
        }

        // 2. Validate Status (Redundant check kept for strictness if needed, or remove)
        if (!['completed', 'assigned'].includes(shiftRecord.status)) {
            // Logic covered by validateShiftTransition, but keeping for safety if config changes
        }

        // 2. Audit Assignments
        const dirtyAssignments: string[] = [];
        const updates: {
            id: string;
            status: "no_show" | "completed";
            grossPayCents: number;
            hourlyRateSnapshot: number | null;
            breakMinutes: number;
            adjustmentNotes: string | null;
        }[] = [];

        for (const assign of shiftRecord.assignments) {
            // CASE: No Show (Empty times)
            if (!assign.clockIn && !assign.clockOut) {
                updates.push({
                    id: assign.id,
                    status: 'no_show',
                    grossPayCents: 0,
                    hourlyRateSnapshot: null,
                    breakMinutes: 0,
                    adjustmentNotes: null
                });
                continue;
            }

            // CASE: Dirty Data (Missing Clock Out)
            if (assign.clockIn && !assign.clockOut) {
                dirtyAssignments.push(assign.workerId);
                continue;
            }

            // CASE: Valid (Calculate Pay)
            if (assign.clockIn && assign.clockOut) {
                // ... (Calculation logic identical to original)
                const scheduledStart = new Date(shiftRecord.startTime);
                const actualClockIn = new Date(assign.clockIn);
                const GRACE_PERIOD_MINUTES = 5;

                const useScheduledStart = actualClockIn <= addMinutes(scheduledStart, GRACE_PERIOD_MINUTES);
                const effectiveStart = useScheduledStart ? scheduledStart : actualClockIn;
                const totalMinutes = differenceInMinutes(assign.clockOut, effectiveStart);

                if (totalMinutes < 0) {
                    dirtyAssignments.push(assign.workerId);
                    continue;
                }

                // WH-126: Trust Manager Break Logic
                const breakMinutes = assign.breakMinutes || 0;

                if (breakMinutes < 0 || breakMinutes >= totalMinutes) {
                    dirtyAssignments.push(assign.workerId);
                    continue;
                }

                const billableMinutes = Math.max(0, totalMinutes - breakMinutes);
                const hours = billableMinutes / 60;
                const rate = shiftRecord.price || 0;
                const pay = Math.ceil(hours * rate);

                let note: string | null = null;
                const scheduledEnd = new Date(shiftRecord.endTime);
                if (differenceInMinutes(assign.clockOut, scheduledEnd) > 15) {
                    note = "Flag: Clock-out >15m past schedule";
                }

                updates.push({
                    id: assign.id,
                    status: 'completed',
                    grossPayCents: pay,
                    hourlyRateSnapshot: rate,
                    breakMinutes: breakMinutes,
                    adjustmentNotes: note
                });
            }
        }

        // 3. Block if Dirty
        if (dirtyAssignments.length > 0) {
            throw new AppError("Cannot approve: Workers missing clock-out times.", "DIRTY_DATA", 409, { workerIds: dirtyAssignments });
        }

        // 5. Commit Changes
        for (const u of updates) {
            await tx.update(shiftAssignment)
                .set({
                    status: u.status,
                    grossPayCents: u.grossPayCents,
                    hourlyRateSnapshot: u.hourlyRateSnapshot,
                    breakMinutes: u.breakMinutes,
                    adjustmentNotes: u.adjustmentNotes
                })
                .where(eq(shiftAssignment.id, u.id));
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

        await logAudit({
            action: 'shift.approved',
            entityType: 'shift',
            entityId: shiftId,
            organizationId: orgId,
            metadata: {
                approvedAssignmentsCount: updates.length,
                totalPayCents: updates.reduce((acc, u) => acc + u.grossPayCents, 0)
            }
        });

        for (const u of updates) {
            if (u.status === 'no_show') {
                const originalAssignment = shiftRecord.assignments.find(a => a.id === u.id);
                if (originalAssignment) {
                    await logAudit({
                        action: 'assignment.no_show',
                        entityType: 'shift_assignment',
                        entityId: u.id,
                        organizationId: orgId,
                        userId: originalAssignment.workerId,
                        metadata: {
                            shiftId: shiftId,
                            reason: 'No clock-in/out recorded at approval'
                        }
                    });
                }
            }
        }

        return Response.json({ success: true }, { status: 200 });
    });

    return result;
};
