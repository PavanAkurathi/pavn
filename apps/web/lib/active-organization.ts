import { headers } from "next/headers";
import { getApiBaseUrl } from "@/lib/constants";

export async function resolveActiveOrganizationId(
    _userId: string,
    activeOrganizationId?: string | null,
) {
    if (activeOrganizationId) {
        return activeOrganizationId;
    }

    const requestHeaders = await headers();
    const response = await fetch(`${getApiBaseUrl()}/organizations/default`, {
        headers: {
            accept: "application/json",
            cookie: requestHeaders.get("cookie") || "",
        },
        cache: "no-store",
    });

    if (!response.ok) {
        return null;
    }

    const payload = (await response.json()) as {
        organizationId?: string | null;
    };

    return payload.organizationId ?? null;
}
