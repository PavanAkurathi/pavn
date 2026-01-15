
import { db } from "@repo/database";
import { timeCorrectionRequest, shiftAssignment } from "@repo/database/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const ReviewAdjustmentSchema = z.object({
    requestId: z.string(),
    action: z.enum(['approve', 'reject']),
    reviewNotes: z.string().optional(),
});

export const getPendingAdjustmentsController = async (orgId: string): Promise<Response> => {
    try {
        const pending = await db.query.timeCorrectionRequest.findMany({
            where: and(
                eq(timeCorrectionRequest.organizationId, orgId),
                eq(timeCorrectionRequest.status, 'pending')
            ),
            with: {
                worker: true,
                shiftAssignment: {
                    with: {
                        shift: true
                    }
                }
            },
            orderBy: [desc(timeCorrectionRequest.createdAt)]
        });

        return Response.json({ requests: pending });
    } catch (error) {
        console.error("Get pending adjustments error:", error);
        return Response.json({ error: "Failed to fetch pending adjustments" }, { status: 500 });
    }
};

export const reviewAdjustmentController = async (req: Request, reviewerId: string, orgId: string): Promise<Response> => {
    try {
        const body = await req.json();
        const parsed = ReviewAdjustmentSchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({
                error: "Validation failed",
                details: parsed.error.flatten()
            }, { status: 400 });
        }

        const { requestId, action, reviewNotes } = parsed.data;

        // 1. Fetch request
        const request = await db.query.timeCorrectionRequest.findFirst({
            where: and(
                eq(timeCorrectionRequest.id, requestId),
                eq(timeCorrectionRequest.organizationId, orgId)
            )
        });

        if (!request) {
            return Response.json({ error: "Request not found" }, { status: 404 });
        }

        if (request.status !== 'pending') {
            return Response.json({ error: "Request already reviewed" }, { status: 400 });
        }

        // 2. Perform action
        await db.transaction(async (tx) => {
            // Update request status
            await tx.update(timeCorrectionRequest)
                .set({
                    status: action === 'approve' ? 'approved' : 'rejected',
                    reviewedBy: reviewerId,
                    reviewedAt: new Date(),
                    reviewNotes,
                    updatedAt: new Date(),
                })
                .where(eq(timeCorrectionRequest.id, requestId));

            // If approved, update the assignment
            if (action === 'approve') {
                const updates: any = {
                    needsReview: false, // Resolve review flag if any
                    reviewReason: null,
                    updatedAt: new Date(),
                };

                if (request.requestedClockIn) updates.clockIn = request.requestedClockIn;
                if (request.requestedClockOut) updates.clockOut = request.requestedClockOut;
                if (request.requestedBreakMinutes !== null) updates.breakMinutes = request.requestedBreakMinutes;

                // Add note to adjustment trail
                updates.adjustedBy = reviewerId;
                updates.adjustedAt = new Date();
                updates.adjustmentNotes = `Approved request ${requestId}: ${reviewNotes || 'No notes'}`;

                await tx.update(shiftAssignment)
                    .set(updates)
                    .where(eq(shiftAssignment.id, request.shiftAssignmentId));
            }
        });

        return Response.json({
            success: true,
            message: `Request ${action}d successfully`
        });

    } catch (error) {
        console.error("Review adjustment error:", error);
        return Response.json({ error: "Failed to process review" }, { status: 500 });
    }
};
