import { MOCK_SHIFTS, MOCK_TIMESHEETS } from "./mock-data";
import { Shift, TimesheetWorker } from "./types";

export interface GetShiftsOptions {
    view?: 'upcoming' | 'past' | 'needs_approval';
}

export const shiftService = {
    getShifts: async (options?: GetShiftsOptions): Promise<Shift[]> => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 50));

        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        // Helper: Is this shift explicitly needing approval?
        const isNeedsApproval = (s: Shift) => {
            if (s.status === 'completed') return true;
            // "Implied" completed: Assigned/In-Progress but ended more than 2 hours ago
            if ((s.status === 'assigned' || s.status === 'in-progress') && new Date(s.endTime) < twoHoursAgo) return true;
            return false;
        };

        if (options?.view === 'upcoming') {
            // Include shifts that are effectively active
            // Ends in future OR (Ends in past < 2h ago AND status is assigned/in-progress)
            return MOCK_SHIFTS.filter(s => {
                const endTime = new Date(s.endTime);
                if (endTime > now) return true; // Future
                // Recent past (within 2 hours) and still active
                if ((s.status === 'assigned' || s.status === 'in-progress') && endTime >= twoHoursAgo) return true;
                return false;
            }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        }

        if (options?.view === 'needs_approval') {
            return MOCK_SHIFTS.filter(isNeedsApproval)
                .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        }

        if (options?.view === 'past') {
            // Unified Past View: Includes "Needs Approval" AND "History" (Approved/Cancelled)
            // Anything that has ended > 2 hours ago, or marked completed/approved/cancelled
            return MOCK_SHIFTS.filter(s => {
                // If it's explicitly completed, approved, or cancelled, it's in the past view
                if (['completed', 'approved', 'cancelled'].includes(s.status)) return true;

                // If it's assigned/in-progress but ended > 2 hours ago (implied past/pending)
                if ((s.status === 'assigned' || s.status === 'in-progress') && new Date(s.endTime) < twoHoursAgo) return true;

                return false;
            }).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        }

        // Default: Return all
        return MOCK_SHIFTS;
    },

    getPendingShiftsCount: async (): Promise<number> => {
        await new Promise(resolve => setTimeout(resolve, 20));
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        return MOCK_SHIFTS.filter(s => {
            if (s.status === 'completed') return true;
            if ((s.status === 'assigned' || s.status === 'in-progress') && new Date(s.endTime) < twoHoursAgo) return true;
            return false;
        }).length;
    },

    getShiftById: async (id: string): Promise<Shift | undefined> => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return MOCK_SHIFTS.find(s => s.id === id);
    },

    getTimesheetsForShift: async (shiftId: string): Promise<TimesheetWorker[]> => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return MOCK_TIMESHEETS[shiftId] || [];
    },

    approveShift: async (shiftId: string): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 50));
        const shift = MOCK_SHIFTS.find(s => s.id === shiftId);
        if (shift) {
            shift.status = 'approved';
        }
    }
};
