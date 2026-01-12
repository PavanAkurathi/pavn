// packages/geofence/src/controllers/review-correction.ts

import { db } from "@repo/database";
import { timeCorrectionRequest, shiftAssignment, member } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const ReviewCorrectionSchema = z.object({
    requestId: z.string(),
    action: z.enum(['approve', 'reject']),
    reviewNotes: z.string().optional(),
});

export async function reviewCorrectionController(
    req: Request,
    managerId: string,
    orgId: string
): Promise<Response> {
    try {
        const body = await req.json();
        const parseResult = ReviewCorrectionSchema.safeParse(body);

        if (!parseResult.success) {
            return Response.json({
                error: "Invalid request",
                details: parseResult.error.flatten()
            }, { status: 400 });
        }

        const { requestId, action, reviewNotes } = parseResult.data;

        // 1. Verify manager is admin/owner in org
        const membership = await db.query.member.findFirst({
            where: and(
                eq(member.userId, managerId),
                eq(member.organizationId, orgId)
            )
        });

        if (!membership || !['admin', 'owner', 'manager'].includes(membership.role)) {
            return Response.json({ error: "Only managers can review corrections" }, { status: 403 });
        }

        // 2. Fetch the correction request
        const request = await db.query.timeCorrectionRequest.findFirst({
            where: and(
                eq(timeCorrectionRequest.id, requestId),
                eq(timeCorrectionRequest.organizationId, orgId)
            ),
            with: {
                shiftAssignment: true
            }
        });

        if (!request) {
            return Response.json({ error: "Correction request not found" }, { status: 404 });
        }

        if (request.status !== 'pending') {
            return Response.json({
                error: "This request has already been reviewed",
                status: request.status
            }, { status: 400 });
        }

        const now = new Date();

        // 3. Process based on action
        if (action === 'approve') {
            // Update the assignment with requested values
            const updateData: Record<string, any> = {
                updatedAt: now,
                needsReview: false,
                adjustedBy: managerId,
                adjustedAt: now,
                adjustmentNotes: reviewNotes || 'Approved worker correction request',
            };

            if (request.requestedClockIn) {
                updateData.clockIn = request.requestedClockIn;
                updateData.clockInMethod = 'manual_override';
                updateData.clockInVerified = false;
            }

            if (request.requestedClockOut) {
                updateData.clockOut = request.requestedClockOut;
                updateData.clockOutMethod = 'manual_override';
                updateData.clockOutVerified = false;
            }

            if (request.requestedBreakMinutes !== null) {
                updateData.breakMinutes = request.requestedBreakMinutes;
            }

            await db.update(shiftAssignment)
                .set(updateData)
                .where(eq(shiftAssignment.id, request.shiftAssignmentId));
        } else {
            // Just clear the review flag if no other issues
            await db.update(shiftAssignment)
                .set({
                    needsReview: false,
                    updatedAt: now,
                })
                .where(eq(shiftAssignment.id, request.shiftAssignmentId));
        }

        // 4. Update the request
        await db.update(timeCorrectionRequest)
            .set({
                status: action === 'approve' ? 'approved' : 'rejected',
                reviewedBy: managerId,
                reviewedAt: now,
                reviewNotes: reviewNotes || null,
                updatedAt: now,
            })
            .where(eq(timeCorrectionRequest.id, requestId));

        return Response.json({
            success: true,
            data: {
                requestId,
                action,
                message: action === 'approve'
                    ? "Correction approved and timesheet updated"
                    : "Correction request rejected"
            }
        });

    } catch (error) {
        console.error("[REVIEW_CORRECTION] Error:", error);
        return Response.json({
            error: "Failed to review correction",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
