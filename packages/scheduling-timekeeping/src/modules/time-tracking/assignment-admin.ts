import { db, TxOrDb } from "@repo/database";
import { shiftAssignment, assignmentAuditEvent, shift } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { differenceInMinutes } from "date-fns";
import { AppError } from "@repo/observability";

export async function getAssignment(shiftId: string, workerId: string, orgId?: string) {
    const assignment = await db.query.shiftAssignment.findFirst({
        where: and(
            eq(shiftAssignment.shiftId, shiftId),
            eq(shiftAssignment.workerId, workerId)
        ),
        with: {
            shift: {
                columns: {
                    organizationId: true,
                },
            },
        },
    });

    if (!assignment) {
        return null;
    }

    if (orgId && assignment.shift?.organizationId !== orgId) {
        return null;
    }

    return assignment;
}

export async function updateAssignmentStatus(
    actorId: string,
    assignmentId: string,
    status: string,
    metadata: Record<string, any> = {},
    orgId?: string,
    tx?: TxOrDb
) {
    const execute = async (transaction: TxOrDb) => {
        const current = await transaction.query.shiftAssignment.findFirst({
            where: eq(shiftAssignment.id, assignmentId),
            with: {
                shift: {
                    columns: {
                        organizationId: true,
                    },
                },
            },
        });

        if (!current) throw new AppError("Assignment not found", "NOT_FOUND", 404);
        if (orgId && current.shift?.organizationId !== orgId) {
            throw new AppError("Assignment not found", "NOT_FOUND", 404);
        }

        await transaction.update(shiftAssignment)
            .set({
                status,
                updatedAt: new Date(),
            })
            .where(eq(shiftAssignment.id, assignmentId));

        await transaction.insert(assignmentAuditEvent).values({
            id: nanoid(),
            assignmentId,
            actorId,
            previousStatus: current.status,
            newStatus: status,
            metadata,
            timestamp: new Date(),
        });
    };

    if (tx) return execute(tx);
    return db.transaction(execute);
}

export async function applyManagerTimesheetUpdate(
    actorId: string,
    orgId: string,
    shiftId: string,
    workerId: string,
    data: { clockIn?: Date | null; clockOut?: Date | null; breakMinutes?: number },
    actorRole: "manager" | "member" = "member",
    tx?: TxOrDb
) {
    const execute = async (transaction: TxOrDb) => {
        const assignment = await transaction.query.shiftAssignment.findFirst({
            where: and(
                eq(shiftAssignment.shiftId, shiftId),
                eq(shiftAssignment.workerId, workerId)
            )
        });

        if (!assignment) throw new AppError("Assignment not found", "NOT_FOUND", 404);

        const targetShift = await transaction.query.shift.findFirst({
            where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
            columns: { startTime: true }
        });

        if (!targetShift) throw new AppError("Shift not found", "NOT_FOUND", 404);

        let effectiveClockIn = data.clockIn;
        if (data.clockIn) {
            if (actorRole === "member" && data.clockIn < targetShift.startTime) {
                effectiveClockIn = targetShift.startTime;
            } else {
                effectiveClockIn = data.clockIn;
            }
        }

        let totalWorkedMinutes = 0;
        if (effectiveClockIn && data.clockOut) {
            const diff = differenceInMinutes(data.clockOut, effectiveClockIn);
            totalWorkedMinutes = Math.max(0, diff - (data.breakMinutes || 0));
        }

        await transaction.update(shiftAssignment)
            .set({
                actualClockIn: data.clockIn,
                effectiveClockIn,
                actualClockOut: data.clockOut,
                effectiveClockOut: data.clockOut,
                breakMinutes: data.breakMinutes || 0,
                totalDurationMinutes: totalWorkedMinutes,
                payoutAmountCents: null,
                status: "completed",
                updatedAt: new Date()
            })
            .where(eq(shiftAssignment.id, assignment.id));

        if (assignment.status !== "completed") {
            await transaction.insert(assignmentAuditEvent).values({
                id: nanoid(),
                assignmentId: assignment.id,
                actorId,
                previousStatus: assignment.status,
                newStatus: "completed",
                metadata: { reason: "Manual Timesheet Update", totalMinutes: totalWorkedMinutes },
                timestamp: new Date()
            });
        }

        return { totalWorkedMinutes };
    };

    if (tx) return execute(tx);
    return db.transaction(execute);
}
