
import useSWR from "swr";
import { authClient } from "@repo/auth/client";

export interface LocationOption {
    id: string;
    name: string;
    address: string;
    timezone?: string;
}

export interface ContactOption {
    id: string; // This is the Member ID
    userId: string; // Linked user account
    name: string;
    phone: string;
    initials: string;
    role: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useOrganizationId() {
    const session = authClient.useSession();
    return session.data?.session.activeOrganizationId;
}

export function useLocations() {
    const orgId = useOrganizationId();

    const { data, error, isLoading } = useSWR<LocationOption[]>(
        orgId ? `/api/organizations/${orgId}/locations` : null,
        fetcher
    );

    return {
        data: data || [],
        isLoading,
        error
    };
}

export function useContacts() {
    const orgId = useOrganizationId();

    const { data, error, isLoading } = useSWR<ContactOption[]>(
        orgId ? `/api/organizations/${orgId}/members` : null,
        fetcher
    );

    return {
        data: data || [],
        isLoading,
        error
    };
}
