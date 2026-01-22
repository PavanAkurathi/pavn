
export interface Role {
    id: string;
    label: string;
}

export interface CrewMember {
    id: string;
    name: string;
    avatar: string;
    roles: string[];
    hours: number;
    initials: string;
}

export const ROLES: Role[] = [
    { id: "all", label: "All" },
    { id: "server", label: "Servers" },
    { id: "bartender", label: "Bartenders" },
    { id: "kitchen", label: "Kitchen" },
    { id: "host", label: "Host" },
];

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useOrganizationId } from "./use-schedule-data";

// Define the shape of a Worker based on your DB Schema
// Duplicate interface removed


const API_BASE = process.env.NEXT_PUBLIC_SHIFTS_API_URL || "http://localhost:4005"; // Shift Service

export function useCrewData() {
    // 1. Get the Context (Org ID)
    const orgId = useOrganizationId();

    // 2. SWR Fetch
    // We need an endpoint in Shift Service to get schedulable crew
    // GET /organizations/:id/crew
    const shouldFetch = orgId ? `${API_BASE}/organizations/${orgId}/crew` : null;

    // Custom fetcher with headers
    const fetcherWithHeaders = async (url: string) => {
        const res = await fetch(url, {
            headers: {
                'x-org-id': orgId || ''
            },
            credentials: 'include'
        });
        if (!res.ok) {
            const error = new Error('An error occurred while fetching the data.');
            (error as any).info = await res.json();
            (error as any).status = res.status;
            throw error;
        }
        return res.json();
    };

    const { data, error, isLoading } = useSWR<CrewMember[]>(shouldFetch, fetcherWithHeaders);



    // 3. Return robust state
    return {
        crew: data || [],
        roles: ROLES, // If you have a separate roles endpoint, fetch it here too
        isLoading,
        isError: error
    };
}
