
import { db } from "@repo/database";
import { timeCorrectionRequest, shiftAssignment } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";

const CreateAdjustmentSchema = z.object({
    shiftAssignmentId: z.string(),
    reason: z.string().min(5).max(500),
    requestedClockIn: z.string().optional(), // ISO string
    requestedClockOut: z.string().optional(), // ISO string
    requestedBreakMinutes: z.number().min(0).optional(),
});

export const createAdjustmentRequestController = async (req: Request, workerId: string, orgId: string): Promise<Response> => {
    try {
        const body = await req.json();
        const parsed = CreateAdjustmentSchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({
                error: "Validation failed",
                details: parsed.error.flatten()
            }, { status: 400 });
        }

        const { shiftAssignmentId, reason, requestedClockIn, requestedClockOut, requestedBreakMinutes } = parsed.data;

        // 1. Verify ownership of the assignment
        const assignment = await db.query.shiftAssignment.findFirst({
            where: and(
                eq(shiftAssignment.id, shiftAssignmentId),
                eq(shiftAssignment.workerId, workerId)
            ),
            with: {
                shift: true
            }
        });

        if (!assignment) {
            return Response.json({ error: "Shift assignment not found or unauthorized" }, { status: 403 });
        }

        // 2. Check if a pending request already exists
        const existingRequest = await db.query.timeCorrectionRequest.findFirst({
            where: and(
                eq(timeCorrectionRequest.shiftAssignmentId, shiftAssignmentId),
                eq(timeCorrectionRequest.status, 'pending')
            )
        });

        if (existingRequest) {
            return Response.json({ error: "A pending adjustment request already exists for this shift" }, { status: 409 });
        }

        // 3. Create request
        const requestId = nanoid();

        await db.insert(timeCorrectionRequest).values({
            id: requestId,
            shiftAssignmentId,
            workerId,
            organizationId: orgId,
            reason,
            requestedClockIn: requestedClockIn ? new Date(requestedClockIn) : null,
            requestedClockOut: requestedClockOut ? new Date(requestedClockOut) : null,
            requestedBreakMinutes,

            // Snapshot current values
            originalClockIn: assignment.clockIn,
            originalClockOut: assignment.clockOut,
            originalBreakMinutes: assignment.breakMinutes,

            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return Response.json({
            success: true,
            requestId,
            message: "Adjustment request submitted successfully"
        }, { status: 201 });

    } catch (error) {
        console.error("Create adjustment error:", error);
        return Response.json({
            error: "Failed to submit adjustment request"
        }, { status: 500 });
    }
};
