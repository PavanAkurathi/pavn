// packages/shifts/src/modules/shifts/edit-shift.ts

import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@repo/database";
import { AppError } from "@repo/observability";

const EditShiftSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
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

    // 4. Validate time ordering if times are changing
    const newStart = updates.startTime ? new Date(updates.startTime) : existing.startTime;
    const newEnd = updates.endTime ? new Date(updates.endTime) : existing.endTime;

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
    if (updates.startTime !== undefined) updateSet.startTime = new Date(updates.startTime);
    if (updates.endTime !== undefined) updateSet.endTime = new Date(updates.endTime);
    if (updates.capacityTotal !== undefined) updateSet.capacityTotal = updates.capacityTotal;
    if (updates.locationId !== undefined) updateSet.locationId = updates.locationId;
    if (updates.contactId !== undefined) updateSet.contactId = updates.contactId;

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

    return {
        success: true,
        shift: updated,
        timeChanged: !!(updates.startTime || updates.endTime),
    };
};
