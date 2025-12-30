// packages/shifts/src/service.ts

import { Shift, TimesheetWorker } from "./types";

export interface GetShiftsOptions {
    view?: 'upcoming' | 'past' | 'needs_approval';
}

const API_BASE = process.env.NEXT_PUBLIC_SHIFTS_API_URL || "http://localhost:4005";

export const shiftService = {
    getShifts: async (options?: GetShiftsOptions): Promise<Shift[]> => {
        // Special Case: "Past" View needs merged data (Pending + History)
        if (options?.view === 'past') {
            try {
                const [pendingRes, historyRes] = await Promise.all([
                    fetch(`${API_BASE}/shifts/pending-approval`),
                    fetch(`${API_BASE}/shifts/history`)
                ]);

                // Parse safely
                const pendingData = pendingRes.ok ? await pendingRes.json() : [];
                const historyData = historyRes.ok ? await historyRes.json() : [];

                // Return combined: Pending (Action Items) first, then History
                return [...(pendingData as Shift[]), ...(historyData as Shift[])];

            } catch (error) {
                console.error("Error fetching past shifts:", error);
                return [];
            }
        }

        // Standard Single-Endpoint Views
        let endpoint = `${API_BASE}/shifts/upcoming`;

        if (options?.view === 'needs_approval') {
            endpoint = `${API_BASE}/shifts/pending-approval`;
        }

        // Note: 'past' is handled above, so no else-if needed here for it, 
        // but default fallback is upcoming if undefined.

        try {
            const response = await fetch(endpoint);
            if (!response.ok) {
                console.error(`Failed to fetch shifts from ${endpoint}: ${response.statusText}`);
                return [];
            }
            const data = await response.json();
            return data as Shift[];
        } catch (error) {
            console.error("Error fetching shifts:", error);
            return [];
        }
    },

    getPendingShiftsCount: async (): Promise<number> => {
        try {
            const response = await fetch(`${API_BASE}/shifts/pending-approval`);
            if (!response.ok) return 0;
            const data = await response.json() as Shift[];
            return data.length;
        } catch (error) {
            console.error("Error fetching pending count:", error);
            return 0;
        }
    },

    getShiftById: async (id: string): Promise<Shift | undefined> => {
        try {
            const response = await fetch(`${API_BASE}/shifts/${id}`);
            if (!response.ok) return undefined;
            return await response.json() as Shift;
        } catch (error) {
            console.error("Error fetching shift:", error);
            return undefined;
        }
    },

    getTimesheetsForShift: async (shiftId: string): Promise<TimesheetWorker[]> => {
        try {
            const response = await fetch(`${API_BASE}/shifts/${shiftId}/timesheets`);
            if (!response.ok) return [];
            return await response.json() as TimesheetWorker[];
        } catch (error) {
            console.error("Error fetching timesheets:", error);
            return [];
        }
    },

    approveShift: async (shiftId: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/shifts/${shiftId}/approve`, {
            method: 'POST',
        });

        if (!res.ok) {
            throw new Error("Failed to approve shift");
        }
    },

    createBulk: async (payload: any): Promise<void> => {
        const res = await fetch(`${API_BASE}/shifts/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            throw new Error("Failed to create schedules");
        }
    },

    publishSchedule: async (payload: any): Promise<void> => {
        const res = await fetch(`${API_BASE}/schedules/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error("Failed to publish schedule");
        }
    }
};
