// packages/geofence/src/controllers/manager-override.ts

import { db } from "@repo/database";
import { shiftAssignment, shift, member } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const OverrideSchema = z.object({
    shiftAssignmentId: z.string(),
    clockIn: z.string().optional(),           // ISO timestamp
    clockOut: z.string().optional(),          // ISO timestamp
    breakMinutes: z.number().optional(),
    notes: z.string().optional(),
});

export async function managerOverrideController(
    req: Request,
    managerId: string,
    orgId: string
): Promise<Response> {
    try {
        const body = await req.json();
        const parseResult = OverrideSchema.safeParse(body);

        if (!parseResult.success) {
            return Response.json({
                error: "Invalid request",
                details: parseResult.error.flatten()
            }, { status: 400 });
        }

        const { shiftAssignmentId, clockIn, clockOut, breakMinutes, notes } = parseResult.data;

        // 1. Verify manager is admin/owner
        const membership = await db.query.member.findFirst({
            where: and(
                eq(member.userId, managerId),
                eq(member.organizationId, orgId)
            )
        });

        if (!membership || !['admin', 'owner', 'manager'].includes(membership.role)) {
            return Response.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        // 2. Fetch assignment and verify org
        const assignment = await db.query.shiftAssignment.findFirst({
            where: eq(shiftAssignment.id, shiftAssignmentId),
            with: {
                shift: true
            }
        });

        if (!assignment) {
            return Response.json({ error: "Assignment not found" }, { status: 404 });
        }

        if (assignment.shift.organizationId !== orgId) {
            return Response.json({ error: "Access denied" }, { status: 403 });
        }

        // 3. Build update
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

        // 4. Update
        await db.update(shiftAssignment)
            .set(updateData)
            .where(eq(shiftAssignment.id, shiftAssignmentId));

        return Response.json({
            success: true,
            data: {
                message: "Timesheet updated",
                adjustedBy: managerId,
                adjustedAt: now.toISOString()
            }
        });

    } catch (error) {
        console.error("[MANAGER_OVERRIDE] Error:", error);
        return Response.json({
            error: "Failed to update timesheet",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
