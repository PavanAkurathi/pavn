// packages/geofence/src/services/manager-override.ts

import { db } from "@repo/database";
import { shiftAssignment, shift, member, assignmentAuditEvent } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { logAudit } from "@repo/database";
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

    // 1. Permission check — schema only has 'admin' and 'member' roles
    const membership = await db.query.member.findFirst({
        where: and(
            eq(member.userId, managerId),
            eq(member.organizationId, orgId)
        )
    });

    if (!membership || membership.role !== 'admin') {
        throw new AppError("Insufficient permissions", "FORBIDDEN", 403);
    }

    // 2. Fetch assignment with shift context
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
    const previousStatus = assignment.status;

    // 3. Build update
    // CRITICAL: Manager overrides = NO SNAPPING.
    // Both actualClockIn and effectiveClockIn = the exact time the manager specifies.
    // Example: Worker showed up at 8:30 AM, manager puts them to work.
    //   Manager sets clockIn = 8:30 AM → actual=8:30, effective=8:30 (NOT snapped to 9:00 AM)
    const updateData: Record<string, any> = {
        updatedAt: now,
        adjustedBy: managerId,
        adjustedAt: now,
        needsReview: false,
    };

    if (clockIn !== undefined) {
        const clockInDate = clockIn ? new Date(clockIn) : null;
        updateData.actualClockIn = clockInDate;
        updateData.effectiveClockIn = clockInDate;
        updateData.clockInMethod = 'manual_override';
        updateData.clockInVerified = false;
    }

    if (clockOut !== undefined) {
        const clockOutDate = clockOut ? new Date(clockOut) : null;
        updateData.actualClockOut = clockOutDate;
        updateData.effectiveClockOut = clockOutDate;
        updateData.clockOutMethod = 'manual_override';
        updateData.clockOutVerified = false;
    }

    if (breakMinutes !== undefined) {
        updateData.breakMinutes = breakMinutes;
    }

    // Determine new status
    const hasClockIn = updateData.actualClockIn !== undefined ? updateData.actualClockIn : assignment.actualClockIn;
    const hasClockOut = updateData.actualClockOut !== undefined ? updateData.actualClockOut : assignment.actualClockOut;

    let newStatus = previousStatus;
    if (hasClockIn && !hasClockOut) {
        newStatus = 'active';
    }
    if (hasClockIn && hasClockOut) {
        newStatus = 'completed';
    }
    updateData.status = newStatus;

    // 4. Execute update + audit in transaction
    await db.transaction(async (tx) => {
        await tx.update(shiftAssignment)
            .set(updateData)
            .where(eq(shiftAssignment.id, shiftAssignmentId));

        // Assignment-level audit event
        await tx.insert(assignmentAuditEvent).values({
            id: nanoid(),
            assignmentId: shiftAssignmentId,
            actorId: managerId,
            previousStatus: previousStatus,
            newStatus: newStatus,
            metadata: {
                action: 'manager_override',
                clockIn: clockIn || null,
                clockOut: clockOut || null,
                breakMinutes: breakMinutes ?? null,
                notes: notes || null,
                previousClockIn: assignment.actualClockIn?.toISOString() || null,
                previousClockOut: assignment.actualClockOut?.toISOString() || null,
                previousBreakMinutes: assignment.breakMinutes,
            },
            timestamp: now,
        });

        // Org-level audit log
        await logAudit({
            action: 'shift_assignment.manager_override',
            entityType: 'shift_assignment',
            entityId: shiftAssignmentId,
            actorId: managerId,
            organizationId: orgId,
            metadata: {
                shiftId: assignment.shiftId,
                workerId: assignment.workerId,
                clockIn, clockOut, breakMinutes, notes,
            }
        });
    });

    return {
        success: true,
        message: "Timesheet updated",
        adjustedBy: managerId,
        adjustedAt: now.toISOString(),
        newStatus,
    };
};
