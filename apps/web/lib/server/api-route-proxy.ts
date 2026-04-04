import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/constants";

export async function proxyApiRequest(
    request: NextRequest,
    path: string,
    options: {
        organizationId?: string;
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

    if (options.organizationId) {
        forwardHeaders["x-org-id"] = options.organizationId;
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

    const payload = await response.text();
    const responseContentType =
        response.headers.get("content-type") || "application/json";

    return new NextResponse(payload, {
        status: response.status,
        headers: {
            "content-type": responseContentType,
        },
    });
}
