// packages/geofence/src/services/flagged-timesheets.ts

import { db } from "@repo/database";
import { shiftAssignment, shift, timeCorrectionRequest } from "@repo/database/schema";
import { eq, and, desc } from "drizzle-orm";

export const getFlaggedTimesheets = async (orgId: string) => {
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

    return {
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
    };
};
