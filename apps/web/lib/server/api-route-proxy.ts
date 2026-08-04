import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/constants";
import { resolveActiveOrganizationId } from "@/lib/active-organization";
import { getApiSession } from "@/lib/server/auth-session";

type SessionWithOptionalActiveOrganization = Awaited<ReturnType<typeof getApiSession>> & {
    session?: {
        activeOrganizationId?: string | null;
    };
};

const FORWARDED_RESPONSE_HEADERS = [
    "content-type",
    "content-disposition",
    "cache-control",
    "etag",
    "last-modified",
] as const;

export async function proxyApiRequest(
    request: NextRequest,
    path: string,
    options: {
        organizationId?: string;
        organizationScoped?: boolean;
    } = {},
) {
    const forwardHeaders: Record<string, string> = {
        accept: request.headers.get("accept") || "application/json",
        cookie: request.headers.get("cookie") || "",
    };

    const contentType = request.headers.get("content-type");
    if (contentType) {
        forwardHeaders["content-type"] = contentType;
    }

    const stripeSignature = request.headers.get("stripe-signature");
    if (stripeSignature) {
        forwardHeaders["stripe-signature"] = stripeSignature;
    }

    let organizationId = options.organizationId || request.headers.get("x-org-id") || undefined;
    if (!organizationId && options.organizationScoped) {
        const session = await getApiSession();
        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized", code: "AUTH_REQUIRED" },
                { status: 401 },
            );
        }

        organizationId = await resolveActiveOrganizationId(
            session.user.id,
            (session as SessionWithOptionalActiveOrganization).session?.activeOrganizationId,
        ) ?? undefined;

        if (!organizationId) {
            return NextResponse.json(
                { error: "Missing organization context", code: "ORG_REQUIRED" },
                { status: 401 },
            );
        }
    }

    if (organizationId) {
        forwardHeaders["x-org-id"] = organizationId;
    }

    const body =
        request.method === "GET" || request.method === "HEAD"
            ? undefined
            : await request.text();

    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        method: request.method,
        headers: forwardHeaders,
        body,
        cache: "no-store",
    });

    const responseHeaders = new Headers();
    for (const header of FORWARDED_RESPONSE_HEADERS) {
        const value = response.headers.get(header);
        if (value) {
            responseHeaders.set(header, value);
        }
    }

    if (!responseHeaders.has("content-type")) {
        responseHeaders.set("content-type", "application/json");
    }

    const responseBody =
        response.status === 204 || response.status === 304 ? null : response.body;

    return new NextResponse(responseBody, {
        status: response.status,
        headers: responseHeaders,
    });
}
