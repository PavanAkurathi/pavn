// packages/geofence/src/services/request-correction.ts

import { db } from "@repo/database";
import { timeCorrectionRequest, shiftAssignment } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { AppError } from "@repo/observability";

const CorrectionRequestSchema = z.object({
    shiftAssignmentId: z.string(),
    requestedClockIn: z.string().optional(),
    requestedClockOut: z.string().optional(),
    requestedBreakMinutes: z.number().optional(),
    reason: z.string().min(10, "Please provide a detailed reason"),
});

export const requestCorrection = async (data: any, workerId: string, orgId: string) => {
    const parseResult = CorrectionRequestSchema.safeParse(data);
    if (!parseResult.success) {
        throw new AppError("Invalid request", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const {
        shiftAssignmentId,
        requestedClockIn,
        requestedClockOut,
        requestedBreakMinutes,
        reason
    } = parseResult.data;

    // 1. Verify Assignment
    const assignment = await db.query.shiftAssignment.findFirst({
        where: and(
            eq(shiftAssignment.id, shiftAssignmentId),
            eq(shiftAssignment.workerId, workerId)
        ),
        with: { shift: true }
    });

    if (!assignment) {
        throw new AppError("Assignment not found", "NOT_FOUND", 404);
    }

    if (assignment.shift.organizationId !== orgId) {
        throw new AppError("Access denied", "FORBIDDEN", 403);
    }

    // 2. Check Exists
    const existingRequest = await db.query.timeCorrectionRequest.findFirst({
        where: and(
            eq(timeCorrectionRequest.shiftAssignmentId, shiftAssignmentId),
            eq(timeCorrectionRequest.status, 'pending')
        )
    });

    if (existingRequest) {
        throw new AppError("You already have a pending correction request for this shift", "DUPLICATE_REQUEST", 400, {
            existingRequestId: existingRequest.id
        });
    }

    // 3. Create
    const requestId = nanoid();
    const now = new Date();

    await db.insert(timeCorrectionRequest).values({
        id: requestId,
        shiftAssignmentId,
        workerId,
        organizationId: orgId,
        requestedClockIn: requestedClockIn ? new Date(requestedClockIn) : null,
        requestedClockOut: requestedClockOut ? new Date(requestedClockOut) : null,
        requestedBreakMinutes: requestedBreakMinutes || null,
        originalClockIn: assignment.actualClockIn,
        originalClockOut: assignment.actualClockOut,
        originalBreakMinutes: assignment.breakMinutes,
        reason,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
    });

    // 4. Flag Assignment
    if (!assignment.needsReview) {
        await db.update(shiftAssignment)
            .set({
                needsReview: true,
                reviewReason: 'disputed',
                updatedAt: now,
            })
            .where(eq(shiftAssignment.id, shiftAssignmentId));
    }

    return {
        requestId,
        status: 'pending',
        message: "Your correction request has been submitted for manager review"
    };
};
