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

async function proxyAuthRequest(request: Request) {
    const url = new URL(request.url);
    const upstreamUrl = new URL(`${url.pathname}${url.search}`, getApiBaseUrl());
    const upstreamHeaders = new Headers();

    for (const [name, value] of request.headers.entries()) {
        if (FORWARDED_HEADER_NAMES.has(name.toLowerCase())) {
            upstreamHeaders.set(name, value);
        }
    }

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
        headers: new Headers(response.headers),
    });
}

export const GET = proxyAuthRequest;
export const POST = proxyAuthRequest;
export const PATCH = proxyAuthRequest;
export const PUT = proxyAuthRequest;
export const DELETE = proxyAuthRequest;
