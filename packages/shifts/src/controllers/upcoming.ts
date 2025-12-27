// packages/shifts/src/controllers/upcoming.ts

import { db } from "../db/mock-db";
import { Shift } from "../types";

export const getUpcomingShifts = (): Response => {
    const now = new Date();

    // Active statuses
    const activeStatuses = ['published', 'assigned', 'in-progress'];

    const upcomingShifts = db.shifts
        .filter(shift => activeStatuses.includes(shift.status))
        // Filter out shifts that are "completed" or "cancelled" strictly
        // (Though status check above handles it, explicit is good for future proofing)

        // Sort: Start Time Ascending (Soonest first)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return Response.json(upcomingShifts, { status: 200 });
};
