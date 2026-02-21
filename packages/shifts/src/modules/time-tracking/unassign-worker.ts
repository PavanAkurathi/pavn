// packages/shifts/src/modules/time-tracking/unassign-worker.ts

import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { logAudit } from "@repo/database";
import { AppError } from "@repo/observability";
import { cancelNotificationByType } from "@repo/notifications";

export const unassignWorker = async (
    shiftId: string,
    workerId: string,
    orgId: string,
    managerId: string
) => {
    // 1. Verify shift belongs to org
    const existingShift = await db.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
        columns: { id: true, status: true, title: true },
    });

    if (!existingShift) {
        throw new AppError("Shift not found", "SHIFT_NOT_FOUND", 404);
    }

    // 2. Can only unassign from non-completed shifts
    if (['completed', 'approved', 'cancelled'].includes(existingShift.status)) {
        throw new AppError(
            `Cannot unassign from a '${existingShift.status}' shift`,
            "INVALID_STATE",
            409
        );
    }

    // 3. Find the assignment
    const assignment = await db.query.shiftAssignment.findFirst({
        where: and(
            eq(shiftAssignment.shiftId, shiftId),
            eq(shiftAssignment.workerId, workerId),
            eq(shiftAssignment.status, "active")
        ),
        columns: { id: true, actualClockIn: true },
    });

    if (!assignment) {
        throw new AppError("Worker is not assigned to this shift", "NOT_FOUND", 404);
    }

    // 4. If worker already clocked in, prevent unassign (must use manager override instead)
    if (assignment.actualClockIn) {
        throw new AppError(
            "Worker has already clocked in. Use manager override to adjust times instead.",
            "ALREADY_CLOCKED_IN",
            409
        );
    }

    // 5. Mark assignment as removed (soft delete — preserve audit trail)
    await db.update(shiftAssignment)
        .set({
            status: "removed",
            updatedAt: new Date(),
        })
        .where(eq(shiftAssignment.id, assignment.id));

    // 6. Cancel any pending notifications for this worker on this shift
    try {
        for (const type of ['night_before', '60_min', '15_min', 'shift_start', 'late_warning'] as const) {
            await cancelNotificationByType(shiftId, workerId, type);
        }
    } catch (e) {
        // Non-critical — don't fail the unassign
        console.warn("[UNASSIGN] Failed to cancel notifications:", e);
    }

    // 7. Audit log
    await logAudit({
        action: "WORKER_UNASSIGNED",
        entityType: "shift_assignment",
        entityId: assignment.id,
        actorId: managerId,
        organizationId: orgId,
        metadata: { shiftId, workerId },
    });

    return {
        success: true,
        message: "Worker unassigned from shift",
        assignmentId: assignment.id,
    };
};
