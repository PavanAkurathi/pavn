// packages/shifts/src/controllers/get-timesheets.ts

import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { TimesheetWorker } from "../types";
import { getInitials } from "../utils/formatting";

export const getShiftTimesheetsController = async (shiftId: string, orgId: string): Promise<Response> => {
    // 1. Verify Shift Ownership
    const validShift = await db.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
        columns: { id: true }
    });

    if (!validShift) {
        return Response.json({ error: "Shift not found" }, { status: 404 });
    }

    // 2. Query DB with inference
    const assignments = await db.query.shiftAssignment.findMany({
        where: eq(shiftAssignment.shiftId, shiftId),
        with: {
            worker: true
        }
    });

    const timesheets: TimesheetWorker[] = assignments.map(a => {
        // Fallback name if worker relation is missing (deleted user?)
        const workerName = a.worker ? a.worker.name : "Unknown Worker";

        return {
            id: a.id,
            name: workerName,
            avatarUrl: a.worker?.image || undefined,
            avatarInitials: getInitials(workerName),
            role: "Worker", // Not in schema yet
            hourlyRate: 0,  // Not in schema yet
            clockIn: a.clockIn ? a.clockIn.toISOString() : undefined,
            clockOut: a.clockOut ? a.clockOut.toISOString() : undefined,
            breakMinutes: a.breakMinutes || 0,
            status: mapAssignmentStatus(a.status as string)
        };
    });

    return Response.json(timesheets, { status: 200 });
};

function mapAssignmentStatus(status: string): TimesheetWorker['status'] {
    // Validate against known UI types: 'rostered' | 'new' | 'blocked' | 'submitted'
    // Schema has 'active', 'completed', 'no_show'.
    // Mapping:
    // active -> rostered (or new if implies unacknowledged)
    // completed -> submitted
    // no_show -> blocked (or separate status if UI supported)

    switch (status) {
        case 'active': return 'rostered';
        case 'completed': return 'submitted';
        case 'no_show': return 'blocked';
        default: return 'rostered';
    }
}
