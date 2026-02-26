// packages/geofence/src/services/review-correction.ts

import { db } from "@repo/database";
import { timeCorrectionRequest, shiftAssignment, member } from "@repo/database/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@repo/observability";

export const getPendingCorrections = async (orgId: string) => {
    return await db.query.timeCorrectionRequest.findMany({
        where: and(
            eq(timeCorrectionRequest.organizationId, orgId),
            eq(timeCorrectionRequest.status, 'pending')
        ),
        with: {
            worker: true,
            shiftAssignment: {
                with: { shift: true }
            }
        },
        orderBy: [desc(timeCorrectionRequest.createdAt)]
    });
};

const ReviewCorrectionSchema = z.object({
    requestId: z.string(),
    action: z.enum(['approve', 'reject']),
    reviewNotes: z.string().optional(),
});

export const reviewCorrection = async (data: any, managerId: string, orgId: string) => {
    const parseResult = ReviewCorrectionSchema.safeParse(data);
    if (!parseResult.success) {
        throw new AppError("Invalid request", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const { requestId, action, reviewNotes } = parseResult.data;

    // 1. Verify Manager
    const membership = await db.query.member.findFirst({
        where: and(
            eq(member.userId, managerId),
            eq(member.organizationId, orgId)
        )
    });

    if (!membership || !['admin', 'owner', 'manager'].includes(membership.role)) {
        throw new AppError("Only managers can review corrections", "FORBIDDEN", 403);
    }

    // 2. Fetch Request
    const request = await db.query.timeCorrectionRequest.findFirst({
        where: and(
            eq(timeCorrectionRequest.id, requestId),
            eq(timeCorrectionRequest.organizationId, orgId)
        ),
        with: { shiftAssignment: true }
    });

    if (!request) {
        throw new AppError("Correction request not found", "NOT_FOUND", 404);
    }

    if (request.status !== 'pending') {
        throw new AppError("This request has already been reviewed", "INVALID_STATE", 400, {
            status: request.status
        });
    }

    const now = new Date();

    // 3. Process
    if (action === 'approve') {
        const updateData: Record<string, any> = {
            updatedAt: now,
            needsReview: false,
            adjustedBy: managerId,
            adjustedAt: now,
            adjustmentNotes: reviewNotes || 'Approved worker correction request',
        };

        if (request.requestedClockIn) {
            updateData.actualClockIn = request.requestedClockIn;
            updateData.clockInMethod = 'manual_override';
            updateData.clockInVerified = false;
        }

        if (request.requestedClockOut) {
            updateData.actualClockOut = request.requestedClockOut;
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
        await db.update(shiftAssignment)
            .set({
                needsReview: false,
                updatedAt: now,
            })
            .where(eq(shiftAssignment.id, request.shiftAssignmentId));
    }

    // 4. Update Request
    await db.update(timeCorrectionRequest)
        .set({
            status: action === 'approve' ? 'approved' : 'rejected',
            reviewedBy: managerId,
            reviewedAt: now,
            reviewNotes: reviewNotes || null,
            updatedAt: now,
        })
        .where(eq(timeCorrectionRequest.id, requestId));

    return {
        requestId,
        action,
        message: action === 'approve' ? "Correction approved" : "Correction rejected"
    };
};
