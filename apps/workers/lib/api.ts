import { CONFIG } from './config';
import * as SecureStore from 'expo-secure-store';
import { authClient } from './auth-client';

// =============================================================================
// TYPES
// =============================================================================

export interface ShiftHours {
    scheduled: number;    // hours (e.g. 8.5)
    worked: number | null; // null if not yet clocked out
    breakMinutes: number;
}

export interface ShiftLocation {
    id: string;
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    geofenceRadius?: number;
}

export interface ShiftOrganization {
    id: string;
    name: string;
}

export interface WorkerShift {
    id: string;
    assignmentId: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    status: string;
    assignmentStatus: string;
    organization: ShiftOrganization;
    location: ShiftLocation;
    hours: ShiftHours;
    timesheet: {
        clockIn?: string;
        clockOut?: string;
        effectiveClockIn?: string;
        effectiveClockOut?: string;
        breakMinutes: number;
        totalDurationMinutes?: number;
    };
    timesheetFlags: {
        missingClockIn: boolean;
        missingClockOut: boolean;
        needsReview: boolean;
        reviewReason?: string;
    };
}

export interface ConflictInfo {
    shiftId: string;
    overlapsWithShiftId: string;
    overlapsWithTitle: string;
    overlapsWithOrg: string;
}

export interface WorkerOrg {
    id: string;
    name: string;
    logo?: string;
    role: string;
}

export interface ClockInRequest {
    shiftId: string;
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    deviceTimestamp: string;
}

export interface CreateAdjustmentRequest {
    shiftAssignmentId: string;
    reason: string;
    requestedClockIn?: string;
    requestedClockOut?: string;
    requestedBreakMinutes?: number;
}

export interface WorkerPreferences {
    nightBeforeEnabled: boolean;
    sixtyMinEnabled: boolean;
    fifteenMinEnabled: boolean;
    shiftStartEnabled: boolean;
    lateWarningEnabled: boolean;
    geofenceAlertsEnabled: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

interface AuthHeaders { [key: string]: string; }

async function getAuthHeaders(includeOrg: boolean = true): Promise<AuthHeaders> {
    const token = await SecureStore.getItemAsync("better-auth.session_token");
    const headers: AuthHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    if (includeOrg) {
        const session = await authClient.getSession();
        const activeOrgId = session.data?.session?.activeOrganizationId;
        if (activeOrgId) {
            headers['x-org-id'] = activeOrgId;
        }
    }

    return headers;
}

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
    const response = await fetch(url, opts);

    if (response.status === 401) {
        await SecureStore.deleteItemAsync("better-auth.session_token");
        // Optionally, we could still throw here so the rejecting promise cascades to the caller
    }

    if (!response.ok) {
        let errMsg: string;
        try {
            const errJson = await response.json();
            errMsg = errJson.error || errJson.message || response.statusText;
        } catch {
            errMsg = await response.text() || response.statusText;
        }
        throw new Error(errMsg);
    }
    return response.json();
}

// =============================================================================
// API
// =============================================================================

export const api = {
    // -------------------------------------------------------------------------
    // CROSS-ORG (no x-org-id needed)
    // -------------------------------------------------------------------------
    worker: {
        /** Get shifts from ALL orgs the worker belongs to */
        getAllShifts: async (
            status: 'upcoming' | 'history' | 'in-progress' | 'all' = 'upcoming',
            orgId?: string,
            limit = 50,
        ): Promise<{ shifts: WorkerShift[]; conflicts: ConflictInfo[]; organizations: WorkerOrg[] }> => {
            const headers = await getAuthHeaders(false); // no x-org-id
            const params = new URLSearchParams({ status, limit: String(limit) });
            if (orgId) params.set('orgId', orgId);
            return fetchJson(`${CONFIG.API_URL}/worker/all-shifts?${params}`, { headers });
        },

        /** Get all orgs the worker belongs to */
        getOrganizations: async (): Promise<{ organizations: WorkerOrg[] }> => {
            const headers = await getAuthHeaders(false);
            return fetchJson(`${CONFIG.API_URL}/worker/organizations`, { headers });
        },

        /** Get worker's own correction requests */
        getAdjustments: async (): Promise<any[]> => {
            const headers = await getAuthHeaders();
            return fetchJson(`${CONFIG.API_URL}/worker/adjustments`, { headers });
        },

        /** Get profile */
        getProfile: async () => {
            const headers = await getAuthHeaders();
            return fetchJson(`${CONFIG.API_URL}/worker/profile`, { headers });
        },

        /** Update profile */
        updateProfile: async (data: { name?: string; image?: string }) => {
            const headers = await getAuthHeaders();
            return fetchJson(`${CONFIG.API_URL}/worker/profile`, {
                method: 'PATCH', headers, body: JSON.stringify(data),
            });
        },
    },

    // -------------------------------------------------------------------------
    // SHIFTS (org-scoped, backwards compat)
    // -------------------------------------------------------------------------
    shifts: {
        getById: async (id: string): Promise<WorkerShift> => {
            const headers = await getAuthHeaders();
            return fetchJson(`${CONFIG.API_URL}/shifts/${id}`, { headers });
        },

        /** Legacy: single-org upcoming shifts */
        getUpcoming: async (): Promise<WorkerShift[]> => {
            const headers = await getAuthHeaders();
            const data = await fetchJson<any>(`${CONFIG.API_URL}/worker/shifts?status=upcoming`, { headers });
            return data.shifts;
        },

        getHistory: async (): Promise<WorkerShift[]> => {
            const headers = await getAuthHeaders();
            const data = await fetchJson<any>(`${CONFIG.API_URL}/worker/shifts?status=history`, { headers });
            return data.shifts;
        },
    },

    // -------------------------------------------------------------------------
    // GEOFENCE / CLOCK
    // -------------------------------------------------------------------------
    geofence: {
        clockIn: async (data: ClockInRequest) => {
            const headers = await getAuthHeaders();
            return fetchJson(`${CONFIG.API_URL}/geofence/clock-in`, {
                method: 'POST', headers, body: JSON.stringify(data),
            });
        },

        clockOut: async (data: ClockInRequest) => {
            const headers = await getAuthHeaders();
            return fetchJson(`${CONFIG.API_URL}/geofence/clock-out`, {
                method: 'POST', headers, body: JSON.stringify(data),
            });
        },
    },

    // -------------------------------------------------------------------------
    // ADJUSTMENTS
    // -------------------------------------------------------------------------
    adjustments: {
        create: async (data: CreateAdjustmentRequest) => {
            const headers = await getAuthHeaders();
            return fetchJson(`${CONFIG.API_URL}/worker/adjustments`, {
                method: 'POST', headers, body: JSON.stringify(data),
            });
        },
    },

    // -------------------------------------------------------------------------
    // PREFERENCES
    // -------------------------------------------------------------------------
    preferences: {
        get: async () => {
            const headers = await getAuthHeaders();
            const data = await fetchJson<any>(`${CONFIG.API_URL}/preferences`, { headers });
            return data.preferences;
        },
        update: async (data: Partial<WorkerPreferences>) => {
            const headers = await getAuthHeaders();
            const res = await fetchJson<any>(`${CONFIG.API_URL}/preferences`, {
                method: 'PATCH', headers, body: JSON.stringify(data),
            });
            return res.preferences;
        },
    },

    // -------------------------------------------------------------------------
    // DEVICES
    // -------------------------------------------------------------------------
    devices: {
        register: async (data: any) => {
            const headers = await getAuthHeaders();
            return fetchJson(`${CONFIG.API_URL}/devices/register`, {
                method: 'POST', headers, body: JSON.stringify(data),
            });
        },
    },

    // -------------------------------------------------------------------------
    // AVAILABILITY
    // -------------------------------------------------------------------------
    availability: {
        get: async (from: string, to: string) => {
            const headers = await getAuthHeaders();
            return fetchJson(`${CONFIG.API_URL}/worker/availability?from=${from}&to=${to}`, { headers });
        },
        set: async (data: { startTime: string; endTime: string; type?: string }) => {
            const headers = await getAuthHeaders();
            return fetchJson(`${CONFIG.API_URL}/worker/availability`, {
                method: 'POST', headers, body: JSON.stringify(data),
            });
        },
    },
};
