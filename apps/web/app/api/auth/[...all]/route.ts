import { getApiBaseUrl } from "@/lib/constants";

const FORWARDED_HEADER_NAMES = new Set([
    "accept",
    "accept-language",
    "content-type",
    "cookie",
    "origin",
    "referer",
    "user-agent",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-vercel-ip-country",
    "cf-ipcountry",
]);

/**
 * Strip or rewrite the Domain attribute from Set-Cookie headers so that
 * cookies set by the upstream API (pavn-api.vercel.app) are scoped to the
 * web app's domain (pavn-web.vercel.app) instead.
 *
 * When Domain is removed entirely, the browser defaults to the "exact host"
 * that served the response — which is the web app, exactly what we want.
 */
function rewriteSetCookieHeaders(
    upstreamHeaders: Headers,
    webHost: string
): Headers {
    const rewritten = new Headers();

    // Copy all non-Set-Cookie headers as-is
    for (const [name, value] of upstreamHeaders.entries()) {
        if (name.toLowerCase() !== "set-cookie") {
            rewritten.append(name, value);
        }
    }

    // Rewrite Set-Cookie: strip Domain= so the browser defaults to the
    // current host (pavn-web.vercel.app). Also skip Better-Auth's dmn_chk_*
    // test cookies entirely — they serve no purpose when cross-subdomain
    // cookies are disabled.
    const rawCookies = upstreamHeaders.getSetCookie?.()
        ?? (upstreamHeaders as any).raw?.()?.["set-cookie"]
        ?? [];

    for (const cookie of rawCookies) {
        // Drop domain-check cookies — they only cause PSL rejections on vercel.app
        if (cookie.includes("dmn_chk_")) continue;

        // Remove Domain=...; from the cookie string
        const cleaned = cookie.replace(/;\s*[Dd]omain=[^;]*/g, "");
        rewritten.append("set-cookie", cleaned);
    }

    return rewritten;
}

async function proxyAuthRequest(request: Request) {
    const url = new URL(request.url);
    const webHost = url.host; // e.g. pavn-web.vercel.app
    const upstreamUrl = new URL(`${url.pathname}${url.search}`, getApiBaseUrl());
    const upstreamHeaders = new Headers();

    for (const [name, value] of request.headers.entries()) {
        if (FORWARDED_HEADER_NAMES.has(name.toLowerCase())) {
            upstreamHeaders.set(name, value);
        }
    }

    // Tell the API the real host the browser is on, so Better-Auth
    // generates cookies scoped to the correct domain.
    upstreamHeaders.set("x-forwarded-host", webHost);

    const init: RequestInit = {
        method: request.method,
        headers: upstreamHeaders,
        redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
        const body = await request.arrayBuffer();
        if (body.byteLength > 0) {
            init.body = body;
        }
    }

    const response = await fetch(upstreamUrl, init);

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: rewriteSetCookieHeaders(response.headers, webHost),
    });
}

export const GET = proxyAuthRequest;
export const POST = proxyAuthRequest;
export const PATCH = proxyAuthRequest;
export const PUT = proxyAuthRequest;
export const DELETE = proxyAuthRequest;
