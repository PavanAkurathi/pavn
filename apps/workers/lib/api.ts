import { CONFIG } from './config';
import * as SecureStore from 'expo-secure-store';
import { authClient } from './auth-client';

// Interfaces
export interface WorkerShift {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    status: string;
    location: {
        id: string;
        name: string;
        address?: string;
        latitude?: number;
        longitude?: number;
        geofenceRadius?: number;
    };
    organization: {
        id: string;
        name: string;
    };
    pay: {
        estimatedPay?: number;
        hourlyRate: number;
    };
    timesheet: {
        clockIn?: string;
        clockOut?: string;
    }
}

export interface ClockInRequest {
    shiftId: string;
    latitude: string;
    longitude: string;
    accuracyMeters?: number;
}

export interface CreateAdjustmentRequest {
    shiftAssignmentId: string;
    reason: string;
    requestedClockIn?: string;
    requestedClockOut?: string;
    requestedBreakMinutes?: number;
}

interface AuthHeaders {
    [key: string]: string;
}

// Helper for headers
async function getAuthHeaders(): Promise<AuthHeaders> {
    const token = await SecureStore.getItemAsync("better-auth.session_token");
    const session = await authClient.getSession();
    const activeOrgId = session.data?.session?.activeOrganizationId;

    if (!activeOrgId) {
        console.warn("[API] No active organization ID found in session.");
    }

    return {
        'x-org-id': activeOrgId || "",
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// API Routes
export const api = {
    shifts: {
        list: async (status: 'upcoming' | 'history' | 'all' = 'upcoming', limit = 20, offset = 0): Promise<WorkerShift[]> => {
            const headers = await getAuthHeaders();
            const url = `${CONFIG.SHIFTS_API_URL}/worker/shifts?status=${status}&limit=${limit}&offset=${offset}`;

            const response = await fetch(url, { headers });

            if (!response.ok) {
                throw new Error(await response.text() || "Failed to fetch shifts");
            }

            const data = await response.json();
            return data.shifts;
        },

        getUpcoming: async () => {
            return api.shifts.list('upcoming');
        },

        getHistory: async () => {
            return api.shifts.list('history');
        },

        getById: async (id: string): Promise<WorkerShift> => {
            const headers = await getAuthHeaders();
            const response = await fetch(`${CONFIG.SHIFTS_API_URL}/shifts/${id}`, { headers });
            if (!response.ok) throw new Error(await response.text());
            return await response.json();
        }
    },

    geofence: {
        clockIn: async (data: ClockInRequest) => {
            const headers = await getAuthHeaders();
            const response = await fetch(`${CONFIG.GEOFENCE_API_URL}/clock-in`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                // Try to parse JSON error
                try {
                    const errJson = await response.json();
                    throw new Error(errJson.error || "Clock-in failed");
                } catch (e) {
                    if (e instanceof Error && e.message !== "Clock-in failed") throw e;
                    throw new Error(await response.text() || "Clock-in failed");
                }
            }
            return await response.json();
        },

        clockOut: async (data: ClockInRequest) => { // Reusing request type as data shape is similar
            const headers = await getAuthHeaders();
            const response = await fetch(`${CONFIG.GEOFENCE_API_URL}/clock-out`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                try {
                    const errJson = await response.json();
                    throw new Error(errJson.error || "Clock-out failed");
                } catch (e) {
                    if (e instanceof Error && e.message !== "Clock-out failed") throw e;
                    throw new Error(await response.text() || "Clock-out failed");
                }
            }
            return await response.json();
        }
    },

    adjustments: {
        create: async (data: CreateAdjustmentRequest) => {
            const headers = await getAuthHeaders();
            const response = await fetch(`${CONFIG.SHIFTS_API_URL}/worker/adjustments`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                try {
                    const errJson = await response.json();
                    throw new Error(errJson.error || "Failed to submit adjustment");
                } catch (e) {
                    if (e instanceof Error && e.message !== "Failed to submit adjustment") throw e;
                    throw new Error(await response.text() || "Failed to submit adjustment");
                }
            }
            return await response.json();
        }
    }
};
