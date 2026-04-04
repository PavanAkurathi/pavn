import { headers } from "next/headers";
import { getApiBaseUrl } from "@/lib/constants";
import { resolveActiveOrganizationId } from "@/lib/active-organization";
import { getApiSession } from "@/lib/server/auth-session";

type ApiRequestOptions = {
    body?: unknown;
    method?: string;
    organizationScoped?: boolean;
    organizationId?: string;
};

async function buildApiHeaders(
    organizationScoped: boolean,
    hasBody: boolean,
    organizationId?: string,
): Promise<Record<string, string>> {
    const requestHeaders = await headers();
    const apiHeaders: Record<string, string> = {
        accept: "application/json",
        cookie: requestHeaders.get("cookie") || "",
    };

    if (hasBody) {
        apiHeaders["content-type"] = "application/json";
    }

    if (!organizationScoped) {
        return apiHeaders;
    }

    if (organizationId) {
        apiHeaders["x-org-id"] = organizationId;
        return apiHeaders;
    }

    const session = await getApiSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const activeOrganizationId = await resolveActiveOrganizationId(
        session.user.id,
        (session.session as any)?.activeOrganizationId as string | undefined,
    );

    if (!activeOrganizationId) {
        throw new Error("No active organization");
    }

    apiHeaders["x-org-id"] = activeOrganizationId;
    return apiHeaders;
}

export async function apiJsonRequest<T>(
    path: string,
    options: ApiRequestOptions = {},
): Promise<T> {
    const method = options.method || "GET";
    const hasBody = options.body !== undefined;
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        method,
        headers: await buildApiHeaders(
            Boolean(options.organizationScoped),
            hasBody,
            options.organizationId,
        ),
        body: hasBody ? JSON.stringify(options.body) : undefined,
        cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message =
            typeof payload === "string"
                ? payload
                : payload?.error || payload?.message || `Request failed (${response.status})`;
        throw new Error(message);
    }

    return payload as T;
}
