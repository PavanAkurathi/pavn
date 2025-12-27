// packages/shifts/src/controllers/pending.ts

import { db } from "../db/mock-db";
import { Shift } from "../types";
import { addHours, parseISO } from "date-fns";

export const getPendingShifts = (): Response => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const pendingShifts = db.shifts.filter(shift => {
        // Condition A: Explicitly Completed
        if (shift.status === 'completed') {
            return true;
        }

        // Condition B: Ghost Shifts (Assigned/In-Progress AND Ended > 2 hours ago)
        if (shift.status === 'assigned' || shift.status === 'in-progress') {
            const endTime = parseISO(shift.endTime);
            // If endTime is before twoHoursAgo, it means it ended more than 2 hours ago
            return endTime < twoHoursAgo;
        }

        return false;
    });

    // Sort by startTime ASC (Oldest first)
    // We want to clear the backlog
    const sortedShifts = pendingShifts.sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Map to DTO with UI flags
    const responseData = sortedShifts.map(shift => ({
        ...shift,
        is_urgent: true,
        ui_category: 'action_required'
    }));

    return Response.json(responseData, { status: 200 });
};
