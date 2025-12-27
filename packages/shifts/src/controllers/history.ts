// packages/shifts/src/controllers/history.ts

import { db } from "../db/mock-db";
import { Shift } from "../types";

export const getHistoryShifts = (): Response => {
    // Finalized statuses: approved, cancelled
    // 'completed' is EXCLUDED because it is pending approval
    const HISTORY_STATUSES = ['approved', 'cancelled'];

    const historyShifts = db.shifts.filter(shift =>
        HISTORY_STATUSES.includes(shift.status)
    );

    // Sort by startTime DESC (Newest first)
    // Archive view behavior
    const sortedShifts = historyShifts.sort((a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    // Map to DTO with UI flags
    const responseData = sortedShifts.map(shift => ({
        ...shift,
        is_urgent: false,
        ui_category: 'history'
    }));

    return Response.json(responseData, { status: 200 });
};
