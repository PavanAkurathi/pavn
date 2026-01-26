
import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { eq, and, or, lt, gt, inArray, not } from "drizzle-orm";

export interface OverlapCheckParams {
    workerId: string;
    startTime: Date;
    endTime: Date;
    excludeShiftId?: string; // For updates
    organizationId?: string; // [SEC] Scope to Org
}

export const findOverlappingAssignment = async (params: OverlapCheckParams) => {
    const { workerId, startTime, endTime, excludeShiftId, organizationId } = params;

    // Overlap Formula: (StartA < EndB) and (EndA > StartB)
    // Here A is existing shift, B is new shift.
    // So: existing.startTime < new.endTime AND existing.endTime > new.startTime

    const whereClause = and(
        eq(shiftAssignment.workerId, workerId),
        // Active statuses
        inArray(shiftAssignment.status, ['active', 'assigned', 'in-progress', 'completed', 'approved']),
        // Exclude current shift if updating
        excludeShiftId ? not(eq(shift.id, excludeShiftId)) : undefined,
        // Optional: Scope to Organization
        organizationId ? eq(shift.organizationId, organizationId) : undefined,
        // Overlap logic
        lt(shift.startTime, endTime),
        gt(shift.endTime, startTime)
    );

    const conflicting = await db.select({
        shiftId: shift.id,
        title: shift.title,
        startTime: shift.startTime,
        endTime: shift.endTime
    })
        .from(shiftAssignment)
        .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
        .where(whereClause)
        .limit(1);

    return conflicting.length > 0 ? conflicting[0] : null;
};
