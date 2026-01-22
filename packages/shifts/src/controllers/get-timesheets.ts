// packages/shifts/src/controllers/get-timesheets.ts

import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { TimesheetWorker } from "../types";
import { getInitials } from "../utils/formatting";
import { AppError } from "@repo/observability";

export const getShiftTimesheetsController = async (shiftId: string, orgId: string): Promise<Response> => {
    // 1. Verify Shift Ownership
    const validShift = await db.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
        columns: { id: true }
    });

    if (!validShift) {
        if (!validShift) {
            throw new AppError("Shift not found", "SHIFT_NOT_FOUND", 404);
        }
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
    // Validate against known UI types: 'rostered' | 'new' | 'blocked' | 'submitted' | 'approved'
    // Mapping:
    switch (status) {
        case 'active':
        case 'assigned':
            return 'rostered';
        case 'completed':
            return 'submitted';
        case 'approved':
            return 'approved';
        case 'cancelled':
            return 'cancelled';
        case 'no_show':
            return 'no-show';
        default:
            console.warn(`[TIMESHEET] Unknown assignment status: "${status}"`);
            return 'rostered';
    }
}
