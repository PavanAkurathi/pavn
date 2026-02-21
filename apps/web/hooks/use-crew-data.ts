
export interface Role {
    id: string;
    label: string;
}

export interface CrewMember {
    id: string; // Worker User ID
    memberId?: string; // Member ID
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


import { API_BASE_URL } from "@/lib/constants";

const API_BASE = API_BASE_URL; // Shift Service

export function useCrewData() {
    // 1. Get the Context (Org ID)
    const orgId = useOrganizationId();

    // 2. SWR Fetch
    // Use Next.js Internal API
    const shouldFetch = orgId ? `/api/organizations/${orgId}/crew` : null;

    // Standard fetcher is fine for internal API
    const { data, error, isLoading } = useSWR<CrewMember[]>(shouldFetch, fetcher);



    // 3. Return robust state
    return {
        crew: data || [],
        roles: ROLES, // If you have a separate roles endpoint, fetch it here too
        isLoading,
        isError: error
    };
}
