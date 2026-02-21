// packages/geofence/src/services/get-worker-corrections.ts

import { db } from "@repo/database";
import { timeCorrectionRequest } from "@repo/database/schema";
import { eq, and, desc } from "drizzle-orm";

export const getWorkerCorrections = async (workerId: string, orgId: string) => {
    const corrections = await db.query.timeCorrectionRequest.findMany({
        where: and(
            eq(timeCorrectionRequest.workerId, workerId),
            eq(timeCorrectionRequest.organizationId, orgId)
        ),
        with: {
            shiftAssignment: {
                with: {
                    shift: {
                        columns: { id: true, title: true, startTime: true }
                    }
                }
            }
        },
        orderBy: [desc(timeCorrectionRequest.createdAt)],
    });

    return corrections.map(r => ({
        id: r.id,
        shiftTitle: r.shiftAssignment?.shift?.title || "Unknown Shift",
        shiftDate: r.shiftAssignment?.shift?.startTime,
        reason: r.reason,
        requestedClockIn: r.requestedClockIn,
        requestedClockOut: r.requestedClockOut,
        originalClockIn: r.originalClockIn,
        originalClockOut: r.originalClockOut,
        status: r.status,
        reviewedAt: r.reviewedAt,
        reviewNotes: r.reviewNotes,
        createdAt: r.createdAt,
    }));
};
