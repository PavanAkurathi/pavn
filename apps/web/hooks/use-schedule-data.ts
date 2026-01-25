
import useSWR from "swr";
import { authClient } from "@repo/auth/client";

import { Location, Contact } from "@/lib/types";

// Removed local LocationOption and ContactOption interfaces in favor of shared types

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useOrganizationId() {
    const session = authClient.useSession();
    const { data: orgs } = authClient.useListOrganizations();

    return session.data?.session.activeOrganizationId || orgs?.[0]?.id;
}

export function useLocations() {
    const orgId = useOrganizationId();

    const { data, error, isLoading, mutate } = useSWR<Location[]>(
        orgId ? `/api/organizations/${orgId}/locations` : null,
        fetcher
    );

    return {
        data: data || [],
        isLoading,
        error,
        mutate
    };
}

export function useContacts() {
    const orgId = useOrganizationId();

    const { data, error, isLoading } = useSWR<Contact[]>(
        orgId ? `/api/organizations/${orgId}/members` : null,
        fetcher
    );

    return {
        data: data || [],
        isLoading,
        error
    };
}
