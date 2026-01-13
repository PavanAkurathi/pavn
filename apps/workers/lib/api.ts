import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { authClient } from './auth-client';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4005";

async function getAuthHeaders() {
    const token = await SecureStore.getItemAsync("better-auth.session_token");

    // Get session to find active Org ID
    const session = await authClient.getSession();
    const activeOrgId = session.data?.session?.activeOrganizationId;

    // Fallback: If no active org, try to find the first membership
    // In a real scenario, we might want to prompt the user to select an org if they have multiple
    // but for this MVP fix, we'll try to be smart.
    let targetOrgId = activeOrgId;

    if (!targetOrgId) {
        // We can't easily fetch memberships here without a working API, 
        // so we rely on what's in the session or fail gracefully.
        // If better-auth stores memberships in the session object, we could use that.
        // For now, we'll assume the user must have an active org set.
    }

    if (!targetOrgId) {
        // As a last ditch effort for the MVP "blocker fix", we maintain the hardcoded one 
        // ONLY if we absolutely cant find one, but we log a loud warning.
        // OR better: we throw an error so the UI handles it.
        // For now, let's just return what we have, the backend might reject it.
        console.warn("[API] No active organization ID found in session.");
    }

    return {
        'x-org-id': targetOrgId || "", // specific backend middleware might handle empty string
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

            // Check if we actually have an org id before making the call
            if (!headers['x-org-id']) {
                throw new Error("No active organization found. Please contact support.");
            }

            // Ideally: GET /shifts/upcoming?workerId=...
            // For MVP Fix #3 (efficient fetching), we add the query param if the backend supports it.
            // If backend doesn't support it yet, we just fix the tenancy part now.
            const response = await fetch(`${API_BASE_URL}/shifts/upcoming`, {
                headers
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error || "Failed to fetch shifts");
            }

            const allShifts = await response.json();

            // Client-side filter still needed until Backend supports query param
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
