import { db, TxOrDb } from "@repo/database";
import { shiftAssignment, assignmentAuditEvent, shift } from "@repo/database/schema";
import { eq, and, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { differenceInMinutes } from "date-fns";
import { AppError } from "@repo/observability";

function resolveManagerUpdateStatus(
    currentStatus: string,
    hasClockIn: boolean,
    hasClockOut: boolean,
) {
    if (currentStatus === "approved" || currentStatus === "cancelled") {
        return currentStatus;
    }

    if (hasClockIn && hasClockOut) {
        return "completed";
    }

    if (hasClockIn) {
        return currentStatus === "in-progress" ? "in-progress" : "active";
    }

    if (currentStatus === "no_show") {
        return "no_show";
    }

    return "active";
}

export async function getAssignment(shiftId: string, workerId: string, orgId?: string) {
    const assignment = await db.query.shiftAssignment.findFirst({
        where: and(
            eq(shiftAssignment.shiftId, shiftId),
            eq(shiftAssignment.workerId, workerId),
            ne(shiftAssignment.status, "removed"),
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
                eq(shiftAssignment.workerId, workerId),
                ne(shiftAssignment.status, "removed"),
            ),
        });

        if (!assignment) throw new AppError("Assignment not found", "NOT_FOUND", 404);

        const targetShift = await transaction.query.shift.findFirst({
            where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
            columns: { startTime: true, status: true }
        });

        if (!targetShift) throw new AppError("Shift not found", "NOT_FOUND", 404);
        if (targetShift.status === "cancelled") {
            throw new AppError("Cannot update timesheets for a cancelled shift", "INVALID_STATE", 409);
        }

        const nextActualClockIn =
            data.clockIn === undefined ? assignment.actualClockIn : data.clockIn;
        const nextActualClockOut =
            data.clockOut === undefined ? assignment.actualClockOut : data.clockOut;
        const nextBreakMinutes = data.breakMinutes ?? assignment.breakMinutes ?? 0;

        let effectiveClockIn = nextActualClockIn;
        if (nextActualClockIn) {
            if (actorRole === "member" && nextActualClockIn < targetShift.startTime) {
                effectiveClockIn = targetShift.startTime;
            } else {
                effectiveClockIn = nextActualClockIn;
            }
        }

        let totalWorkedMinutes = 0;
        if (effectiveClockIn && nextActualClockOut) {
            const diff = differenceInMinutes(nextActualClockOut, effectiveClockIn);
            totalWorkedMinutes = Math.max(0, diff - nextBreakMinutes);
        }
        const nextStatus = resolveManagerUpdateStatus(
            assignment.status,
            Boolean(nextActualClockIn),
            Boolean(nextActualClockOut),
        );

        await transaction.update(shiftAssignment)
            .set({
                actualClockIn: nextActualClockIn ?? null,
                effectiveClockIn,
                actualClockOut: nextActualClockOut ?? null,
                effectiveClockOut: nextActualClockOut ?? null,
                breakMinutes: nextBreakMinutes,
                totalDurationMinutes: totalWorkedMinutes,
                payoutAmountCents: null,
                status: nextStatus,
                updatedAt: new Date()
            })
            .where(eq(shiftAssignment.id, assignment.id));

        if (assignment.status !== nextStatus) {
            await transaction.insert(assignmentAuditEvent).values({
                id: nanoid(),
                assignmentId: assignment.id,
                actorId,
                previousStatus: assignment.status,
                newStatus: nextStatus,
                metadata: { reason: "Manual Timesheet Update", totalMinutes: totalWorkedMinutes },
                timestamp: new Date()
            });
        }

        return { totalWorkedMinutes };
    };

    if (tx) return execute(tx);
    return db.transaction(execute);
}
