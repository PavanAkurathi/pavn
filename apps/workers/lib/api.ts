import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { authClient } from './auth-client';

// Use localhost for simulators, or specific IP for physical devices
// In a real app, this would come from process.env.EXPO_PUBLIC_API_URL
const API_BASE_URL = "http://localhost:4005";

// Hardcoded for now, should come from auth/session
const DEFAULT_ORG_ID = "org_1";

async function getAuthHeaders() {
    const token = await SecureStore.getItemAsync("better-auth.session_token");
    return {
        'x-org-id': DEFAULT_ORG_ID,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

export const api = {
    shifts: {
        getUpcoming: async () => {
            const session = await authClient.getSession();
            const workerId = session.data?.user?.id;

            if (!workerId) throw new Error("Not authenticated");

            const headers = await getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/shifts/upcoming`, {
                headers
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error || "Failed to fetch shifts");
            }

            const allShifts = await response.json();

            // Client-side filter for now (until API supports ?workerId=...)
            // Filtering for shifts that are assigned to this worker
            return allShifts.filter((s: any) =>
                s.assignments?.some((a: any) => a.workerId === workerId)
            );
        },

        clockIn: async (shiftId: string, timestamp: string) => {
            const session = await authClient.getSession();
            const workerId = session.data?.user?.id;

            if (!workerId) throw new Error("Not authenticated");

            const headers = await getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/shifts/${shiftId}/timesheet`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    action: 'update_time',
                    workerId: workerId,
                    data: {
                        clockIn: timestamp
                    }
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error || "Failed to clock in");
            }

            return await response.json();
        }
    }
};
