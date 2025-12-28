// packages/shifts/src/controllers/get-timesheets.ts

import { db } from "@repo/database";
import { shiftAssignment } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { TimesheetWorker } from "../types";

export const getShiftTimesheetsController = async (shiftId: string): Promise<Response> => {
    // 1. Query DB for assignments linked to this shift
    const assignments = await db.query.shiftAssignment.findMany({
        where: eq(shiftAssignment.shiftId, shiftId),
        with: {
            worker: true
        }
    });

    // 2. Map to TimesheetWorker DTO
    // Note: In schema, 'worker' is related to 'user' table usually, ensure types match.
    // Assuming worker has firstName, lastName, avatarUrl, etc.

    // We need to handle case where worker relation might be null if data integrity issues, 
    // but Drizzle types should warn us. 

    const timesheets: TimesheetWorker[] = assignments.map(a => {
        const workerName = a.worker
            ? a.worker.name
            : "Unknown Worker";

        // Extract initials from name if not available
        const initials = workerName
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

        return {
            id: a.id, // Timesheet ID matches Assignment ID in this simple model
            name: workerName,
            avatarUrl: a.worker?.image || undefined,
            avatarInitials: initials, // Use calculated initials
            role: "Worker", // Default role as it's not in schema yet
            hourlyRate: 0,  // Default as it's not in schema yet
            clockIn: a.clockIn ? a.clockIn.toISOString() : undefined,
            clockOut: a.clockOut ? a.clockOut.toISOString() : undefined,
            breakMinutes: a.breakMinutes || 0,
            status: (a.status as any) || 'assigned',
            // Mapping DB status to UI status if needed, 
            // for now casting to any to bypass strict literal check if mismatch,
            // or we should align types.ts with schema.ts enums.
        };
    });

    return Response.json(timesheets, { status: 200 });
};
