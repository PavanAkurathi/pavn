// packages/geofence/src/controllers/request-correction.ts

import { db } from "@repo/database";
import { timeCorrectionRequest, shiftAssignment } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";

const CorrectionRequestSchema = z.object({
    shiftAssignmentId: z.string(),
    requestedClockIn: z.string().optional(),      // ISO timestamp
    requestedClockOut: z.string().optional(),     // ISO timestamp
    requestedBreakMinutes: z.number().optional(),
    reason: z.string().min(10, "Please provide a detailed reason"),
});

export async function requestCorrectionController(
    req: Request,
    workerId: string,
    orgId: string
): Promise<Response> {
    try {
        const body = await req.json();
        const parseResult = CorrectionRequestSchema.safeParse(body);

        if (!parseResult.success) {
            return Response.json({
                error: "Invalid request",
                details: parseResult.error.flatten()
            }, { status: 400 });
        }

        const {
            shiftAssignmentId,
            requestedClockIn,
            requestedClockOut,
            requestedBreakMinutes,
            reason
        } = parseResult.data;

        // 1. Verify assignment belongs to worker
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
            return Response.json({ error: "Assignment not found" }, { status: 404 });
        }

        if (assignment.shift.organizationId !== orgId) {
            return Response.json({ error: "Access denied" }, { status: 403 });
        }

        // 2. Check for existing pending request
        const existingRequest = await db.query.timeCorrectionRequest.findFirst({
            where: and(
                eq(timeCorrectionRequest.shiftAssignmentId, shiftAssignmentId),
                eq(timeCorrectionRequest.status, 'pending')
            )
        });

        if (existingRequest) {
            return Response.json({
                error: "You already have a pending correction request for this shift",
                existingRequestId: existingRequest.id
            }, { status: 400 });
        }

        // 3. Create correction request
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
            originalClockIn: assignment.clockIn,
            originalClockOut: assignment.clockOut,
            originalBreakMinutes: assignment.breakMinutes,
            reason,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
        });

        // 4. Flag the assignment if not already flagged
        if (!assignment.needsReview) {
            await db.update(shiftAssignment)
                .set({
                    needsReview: true,
                    reviewReason: 'disputed',
                    updatedAt: now,
                })
                .where(eq(shiftAssignment.id, shiftAssignmentId));
        }

        return Response.json({
            success: true,
            data: {
                requestId,
                status: 'pending',
                message: "Your correction request has been submitted for manager review"
            }
        });

    } catch (error) {
        console.error("[REQUEST_CORRECTION] Error:", error);
        return Response.json({
            error: "Failed to submit correction request",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
