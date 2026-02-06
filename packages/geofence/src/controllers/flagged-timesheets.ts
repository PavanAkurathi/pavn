// packages/geofence/src/controllers/flagged-timesheets.ts

import { db } from "@repo/database";
import { shiftAssignment, shift, timeCorrectionRequest } from "@repo/database/schema";
import { eq, and, desc } from "drizzle-orm";

export async function getFlaggedTimesheetsController(orgId: string): Promise<Response> {
    try {
        // Get all assignments that need review
        const flagged = await db.query.shiftAssignment.findMany({
            where: and(
                eq(shiftAssignment.needsReview, true)
            ),
            with: {
                shift: {
                    with: {
                        location: true
                    }
                },
                worker: true
            },
            orderBy: [desc(shiftAssignment.updatedAt)]
        });

        // Filter to only include assignments from this org (since complex join filtering in 'with' can be tricky, doing here for safety or ensuring query structure is correct)
        // With 'with' clause filtering on shift: { where: eq(shift.organizationId, orgId) } logic in Drizzle is better if possible, but let's stick to user's robust logic if provided or standard practice.
        // User's prompt: "Filter to only include assignments from this org" (post-fetch filter in array code).
        // Let's optimize slightly: if we can't easily filter shiftAssignment by related shift.orgId at root level without join helpers, we fetch broader and filter.
        // Or deeper query:

        // We can trust the user's provided implementation pattern which filters in memory:
        const orgFlagged = flagged.filter(a => a.shift?.organizationId === orgId);

        // Get pending correction requests
        const pendingRequests = await db.query.timeCorrectionRequest.findMany({
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
            }
        });

        return Response.json({
            flaggedTimesheets: orgFlagged.map(a => ({
                assignmentId: a.id,
                shiftId: a.shift?.id,
                shiftTitle: a.shift?.title,
                shiftDate: a.shift?.startTime,
                locationName: a.shift?.location?.name,
                workerId: a.workerId,
                workerName: a.worker?.name,
                clockIn: a.actualClockIn,
                clockOut: a.actualClockOut,
                reviewReason: a.reviewReason,
                lastKnownAt: a.lastKnownAt,
            })),
            pendingCorrections: pendingRequests.map(r => ({
                requestId: r.id,
                assignmentId: r.shiftAssignmentId,
                shiftTitle: r.shiftAssignment?.shift?.title,
                workerName: r.worker?.name,
                reason: r.reason,
                requestedClockIn: r.requestedClockIn,
                requestedClockOut: r.requestedClockOut,
                originalClockIn: r.originalClockIn,
                originalClockOut: r.originalClockOut,
                createdAt: r.createdAt,
            })),
            summary: {
                totalFlagged: orgFlagged.length,
                totalPendingCorrections: pendingRequests.length,
            }
        });

    } catch (error) {
        console.error("[FLAGGED_TIMESHEETS] Error:", error);
        return Response.json({
            error: "Failed to fetch flagged timesheets",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
