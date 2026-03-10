import { db, TxOrDb } from "@repo/database";
import { scheduledNotification, shift, shiftAssignment } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { AppError } from "@repo/observability";
import { sendPushNotification } from "@repo/notifications";

export const cancelShift = async (shiftId: string, orgId: string, userId: string, tx: TxOrDb = db) => {
    // 1. Verify Shift Exists & Ownership
    const existingShift = await tx.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
        columns: { id: true, status: true, title: true },
        with: {
            location: {
                columns: { name: true },
            },
            assignments: {
                columns: {
                    workerId: true,
                    status: true,
                },
            },
        },
    });

    if (!existingShift) {
        throw new AppError("Shift not found", "NOT_FOUND", 404);
    }

    if (existingShift.status === 'completed' || existingShift.status === 'cancelled') {
        throw new AppError(`Cannot cancel a shift that is already ${existingShift.status}`, "INVALID_STATE", 400);
    }

    // 2. Update Shift Status
    await tx.update(shift)
        .set({ status: 'cancelled' })
        .where(eq(shift.id, shiftId));

    // 3. Update Assignments
    // We update all assignments for this shift to 'cancelled'
    await tx.update(shiftAssignment)
        .set({ status: 'cancelled' })
        .where(eq(shiftAssignment.shiftId, shiftId));

    // 4. Cancel any pending reminder notifications for this shift.
    await tx.update(scheduledNotification)
        .set({
            status: 'cancelled',
            updatedAt: new Date(),
        })
        .where(and(
            eq(scheduledNotification.shiftId, shiftId),
            eq(scheduledNotification.status, 'pending')
        ));

    // 5. Best-effort push notification for assigned workers.
    const workerIds = Array.from(
        new Set(
            existingShift.assignments
                .filter((assignment) => assignment.workerId && assignment.status !== "cancelled")
                .map((assignment) => assignment.workerId as string)
        )
    );

    if (workerIds.length > 0) {
        const title = "Shift cancelled";
        const venueName = existingShift.location?.name;
        const body = venueName
            ? `${existingShift.title} at ${venueName} was cancelled. Check the app for the updated schedule.`
            : `${existingShift.title} was cancelled. Check the app for the updated schedule.`;

        await Promise.allSettled(
            workerIds.map((workerId) =>
                sendPushNotification({
                    workerId,
                    title,
                    body,
                    data: {
                        type: "shift_cancelled",
                        shiftId,
                        url: "/(tabs)",
                    },
                })
            )
        );
    }

    return { success: true, message: "Shift cancelled successfully" };
};
