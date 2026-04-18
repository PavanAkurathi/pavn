import { getApiBaseUrl } from "@/lib/constants";
import { NextResponse } from "next/server";

// ── Request headers to forward to the upstream API ──────────────────────────
const FORWARDED_REQUEST_HEADERS = new Set([
    "accept",
    "accept-language",
    "content-type",
    "cookie",
    "origin",
    "referer",
    "user-agent",
    "x-forwarded-for",
    "x-forwarded-proto",
    "x-vercel-ip-country",
    "cf-ipcountry",
]);

// ── Response headers that must NOT be forwarded back to the browser ─────────
// fetch() auto-decompresses the body, so encoding/length headers from the
// upstream would mismatch the actual (decompressed) bytes we send.
const SKIP_RESPONSE_HEADERS = new Set([
    "content-encoding",
    "content-length",
    "transfer-encoding",
]);

/**
 * Auth proxy: forwards /api/auth/* requests from the browser to the
 * upstream API (pavn-api.vercel.app) and returns the response.
 *
 * Key responsibilities:
 *  - Read the upstream body fully (avoids ReadableStream lock issues)
 *  - Strip content-encoding (fetch already decompressed)
 *  - Strip Domain= from Set-Cookie (cookies must scope to pavn-web, not pavn-api)
 *  - Drop Better-Auth dmn_chk_* domain-probe cookies (Vercel's .vercel.app is a
 *    Public Suffix — these probes always fail and produce console errors)
 */
async function proxyAuthRequest(request: Request) {
    const url = new URL(request.url);
    const webHost = url.host; // pavn-web.vercel.app
    const upstreamUrl = new URL(
        `${url.pathname}${url.search}`,
        getApiBaseUrl()
    );

    // ── Build upstream request headers ──────────────────────────────────────
    const upstreamHeaders = new Headers();
    for (const [name, value] of request.headers.entries()) {
        if (FORWARDED_REQUEST_HEADERS.has(name.toLowerCase())) {
            upstreamHeaders.set(name, value);
        }
    }
    // Tell the API the browser's real host so Better-Auth scopes cookies correctly
    upstreamHeaders.set("x-forwarded-host", webHost);

    // ── Build request init ──────────────────────────────────────────────────
    const init: RequestInit = {
        method: request.method,
        headers: upstreamHeaders,
        redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
        const reqBody = await request.arrayBuffer();
        if (reqBody.byteLength > 0) {
            init.body = reqBody;
        }
    }

    // ── Execute upstream request ────────────────────────────────────────────
    const upstream = await fetch(upstreamUrl, init);

    // Read the full body as bytes — avoids ReadableStream locking issues
    // that cause "Decoding failed" in some Next.js runtimes.
    const body = await upstream.arrayBuffer();

    // ── Build browser response ──────────────────────────────────────────────
    const res = new NextResponse(body, {
        status: upstream.status,
        statusText: upstream.statusText,
    });

    // Copy safe headers (skip encoding-related ones)
    for (const [name, value] of upstream.headers.entries()) {
        const lower = name.toLowerCase();
        if (lower === "set-cookie" || SKIP_RESPONSE_HEADERS.has(lower)) continue;
        res.headers.append(name, value);
    }

    // ── Handle Set-Cookie: rewrite for correct domain ───────────────────────
    // We need the raw individual Set-Cookie strings. Different runtimes expose
    // these differently, so we try every known method.
    const cookies = extractSetCookies(upstream.headers);

    for (const cookie of cookies) {
        // Drop Better-Auth domain-check probes (always rejected on PSL domains)
        if (cookie.includes("dmn_chk_")) continue;

        // Strip Domain=xxx so the browser defaults to the current host
        // (pavn-web.vercel.app) instead of the upstream API host
        const cleaned = cookie.replace(/;\s*[Dd]omain=[^;]*/g, "");
        res.headers.append("set-cookie", cleaned);
    }

    return res;
}

/**
 * Extract individual Set-Cookie header values from a Headers object.
 * Different JS runtimes have different APIs for this, so we try them all.
 */
function extractSetCookies(headers: Headers): string[] {
    // Method 1: Standard API (Node 20+, Bun, Deno, Cloudflare Workers)
    if (typeof headers.getSetCookie === "function") {
        const result = headers.getSetCookie();
        if (result && result.length > 0) return result;
    }

    // Method 2: Node.js undici raw headers
    if (typeof (headers as any).raw === "function") {
        const raw = (headers as any).raw();
        if (raw?.["set-cookie"]) return raw["set-cookie"];
    }

    // Method 3: Fallback — get the joined string and split it.
    // This is imperfect (cookies can contain commas in Expires), but it's
    // better than losing cookies entirely.
    const joined = headers.get("set-cookie");
    if (joined) {
        // Split on comma followed by a cookie name (word=), avoiding
        // splitting on "Expires=Thu, 01 Jan 2026" date commas.
        return joined.split(/,(?=\s*[a-zA-Z0-9_.-]+=)/);
    }

    return [];
}

export const GET = proxyAuthRequest;
export const POST = proxyAuthRequest;
export const PATCH = proxyAuthRequest;
export const PUT = proxyAuthRequest;
export const DELETE = proxyAuthRequest;
