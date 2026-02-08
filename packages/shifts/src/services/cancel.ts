import { db, TxOrDb } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { AppError } from "@repo/observability";

export const cancelShift = async (shiftId: string, orgId: string, userId: string, tx: TxOrDb = db) => {
    // 1. Verify Shift Exists & Ownership
    const existingShift = await tx.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
        columns: { id: true, status: true }
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

    // TODO: Send notifications to assigned workers

    return { success: true, message: "Shift cancelled successfully" };
};
