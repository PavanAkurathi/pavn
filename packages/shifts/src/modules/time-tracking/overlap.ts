
import { db } from "@repo/database";
import { shiftAssignment, shift, workerAvailability } from "@repo/database/schema";
import { eq, and, ne, lte, gte, or } from "drizzle-orm";

export class OverlapService {
    static async findOverlappingAssignment(
        userId: string,
        startTime: Date,
        endTime: Date,
        requesterOrgId: string,
        excludeAssignmentId?: string
    ) {
        // 1. Internal Overlap Check: Strict Scoping to requesterOrgId
        // We do NOT verify overlapping shifts from other organizations (Privacy).
        const internalConflict = await db.select({ id: shiftAssignment.id })
            .from(shiftAssignment)
            .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
            .where(and(
                eq(shiftAssignment.workerId, userId),
                ne(shiftAssignment.status, 'cancelled'),
                eq(shift.organizationId, requesterOrgId), // STRICT: Internal Only
                lte(shift.startTime, endTime),
                gte(shift.endTime, startTime),
                excludeAssignmentId ? ne(shiftAssignment.id, excludeAssignmentId) : undefined
            ))
            .limit(1);

        if (internalConflict.length > 0) {
            return {
                conflict: true,
                type: 'internal_conflict',
                message: 'Worker already has an overlapping shift in this organization.'
            };
        }

        // 2. Global Availability Check: Hard Block if 'unavailable'
        // This is the only "global" check we allow.
        const unavailConflict = await db.query.workerAvailability.findFirst({
            where: and(
                eq(workerAvailability.workerId, userId),
                eq(workerAvailability.type, 'unavailable'),
                lte(workerAvailability.startTime, endTime),
                gte(workerAvailability.endTime, startTime)
            )
        });

        if (unavailConflict) {
            return {
                conflict: true,
                type: 'unavailable',
                message: 'Worker is marked as unavailable for this time.'
            };
        }

        return { conflict: false };
    }
}
