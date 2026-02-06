// packages/geofence/src/services/manager-override.ts

import { db } from "@repo/database";
import { shiftAssignment, shift, member } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@repo/observability";

const OverrideSchema = z.object({
    shiftAssignmentId: z.string(),
    clockIn: z.string().optional(),
    clockOut: z.string().optional(),
    breakMinutes: z.number().optional(),
    notes: z.string().optional(),
});

export const managerOverride = async (data: any, managerId: string, orgId: string) => {
    const parseResult = OverrideSchema.safeParse(data);
    if (!parseResult.success) {
        throw new AppError("Invalid request", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const { shiftAssignmentId, clockIn, clockOut, breakMinutes, notes } = parseResult.data;

    const membership = await db.query.member.findFirst({
        where: and(
            eq(member.userId, managerId),
            eq(member.organizationId, orgId)
        )
    });

    if (!membership || !['admin', 'owner', 'manager'].includes(membership.role)) {
        throw new AppError("Insufficient permissions", "FORBIDDEN", 403);
    }

    const assignment = await db.query.shiftAssignment.findFirst({
        where: eq(shiftAssignment.id, shiftAssignmentId),
        with: { shift: true }
    });

    if (!assignment) {
        throw new AppError("Assignment not found", "NOT_FOUND", 404);
    }

    if (assignment.shift.organizationId !== orgId) {
        throw new AppError("Access denied", "FORBIDDEN", 403);
    }

    const now = new Date();
    const updateData: Record<string, any> = {
        updatedAt: now,
        adjustedBy: managerId,
        adjustedAt: now,
        adjustmentNotes: notes || 'Manager adjustment',
        needsReview: false,
    };

    if (clockIn !== undefined) {
        updateData.clockIn = clockIn ? new Date(clockIn) : null;
        updateData.clockInMethod = 'manual_override';
        updateData.clockInVerified = false;
    }

    if (clockOut !== undefined) {
        updateData.clockOut = clockOut ? new Date(clockOut) : null;
        updateData.clockOutMethod = 'manual_override';
        updateData.clockOutVerified = false;
    }

    if (breakMinutes !== undefined) {
        updateData.breakMinutes = breakMinutes;
    }

    await db.update(shiftAssignment)
        .set(updateData)
        .where(eq(shiftAssignment.id, shiftAssignmentId));

    return {
        message: "Timesheet updated",
        adjustedBy: managerId,
        adjustedAt: now.toISOString()
    };
};
