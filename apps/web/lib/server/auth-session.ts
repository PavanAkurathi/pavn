import type { Session } from "@repo/auth/client";
import { headers } from "next/headers";
import { getApiBaseUrl } from "@/lib/constants";

export async function getApiSession(): Promise<Session | null> {
    const requestHeaders = await headers();
    const response = await fetch(`${getApiBaseUrl()}/api/auth/get-session`, {
        headers: {
            accept: "application/json",
            cookie: requestHeaders.get("cookie") || "",
        },
        cache: "no-store",
    });

    if (!response.ok) {
        if (response.status === 401) {
            return null;
        }

        throw new Error(`[Auth] Failed to resolve session from API (${response.status})`);
    }

    const session = (await response.json()) as Session | null;
    return session ?? null;
}
