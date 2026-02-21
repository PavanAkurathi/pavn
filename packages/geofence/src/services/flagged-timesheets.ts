// packages/geofence/src/services/flagged-timesheets.ts

import { db } from "@repo/database";
import { shiftAssignment, shift, timeCorrectionRequest, location, user } from "@repo/database/schema";
import { eq, and, desc } from "drizzle-orm";

export const getFlaggedTimesheets = async (orgId: string) => {
    // Get flagged assignments — org-scoped at SQL level via inner join on shift
    const flagged = await db
        .select({
            assignmentId: shiftAssignment.id,
            shiftId: shift.id,
            shiftTitle: shift.title,
            shiftDate: shift.startTime,
            locationName: location.name,
            workerId: shiftAssignment.workerId,
            workerName: user.name,
            clockIn: shiftAssignment.actualClockIn,
            clockOut: shiftAssignment.actualClockOut,
            reviewReason: shiftAssignment.reviewReason,
            lastKnownAt: shiftAssignment.lastKnownAt,
        })
        .from(shiftAssignment)
        .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
        .leftJoin(location, eq(shift.locationId, location.id))
        .leftJoin(user, eq(shiftAssignment.workerId, user.id))
        .where(and(
            eq(shiftAssignment.needsReview, true),
            eq(shift.organizationId, orgId)
        ))
        .orderBy(desc(shiftAssignment.updatedAt));

    // Get pending correction requests (already org-scoped)
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
        flaggedTimesheets: flagged,
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
            totalFlagged: flagged.length,
            totalPendingCorrections: pendingRequests.length,
        }
    };
};
