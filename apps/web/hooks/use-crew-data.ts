export interface Role {
    id: string;
    label: string;
}

export interface CrewMember {
    id: string; // The worker's id: what shift assignments point at
    name: string;
    avatar: string;
    roles: string[];
    hours: number;
    initials: string;
    status?: "added" | "invited" | "active" | "inactive";
    employmentType?: "staff" | "agency";
    /** True for workers invited to the app who haven't signed in yet. */
    invitePending?: boolean;
}

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useOrganizationId } from "./use-schedule-data";
import { buildRoleOptions } from "@/lib/schedule/roles";

// Define the shape of a Worker based on your DB Schema
// Duplicate interface removed


export function useCrewData() {
    // 1. Get the Context (Org ID)
    const orgId = useOrganizationId();

    // 2. SWR Fetch
    // Use Next.js Internal API
    const shouldFetch = orgId ? `/api/organizations/${orgId}/crew` : null;

    // Standard fetcher is fine for internal API
    const { data: everyone, error, isLoading } = useSWR<CrewMember[]>(shouldFetch, fetcher);

    // Who can be put on a shift: the business's own people who are not paused.
    // Agency temps have their own picker.
    const data = everyone?.filter((worker) => worker.employmentType !== "agency" && worker.status !== "inactive");



    // 3. Return robust state
    return {
        crew: data || [],
        roles: buildRoleOptions(data || []),
        isLoading,
        isError: error
    };
}
