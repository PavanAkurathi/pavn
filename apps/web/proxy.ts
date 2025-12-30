// apps/web/proxy.ts
// latestnextjs renamed middleware to proxy
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
    // 1. Geo-Blocking for Registration (Store Bouncer)
    const { pathname } = request.nextUrl;

    // Check if user is trying to register (POST /api/auth/sign-up/email)
    if (pathname === "/api/auth/sign-up/email" && request.method === "POST") {
        const country = request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry");

        // If country header exists (Prod) and is NOT US/CA -> Block
        // If header is missing (Dev/Localhost) -> Allow
        if (country && !["US", "CA"].includes(country)) {
            return NextResponse.json(
                { message: "Registration is currently limited to the US and Canada." },
                { status: 403 }
            );
        }
    }

    try {
        const sessionUrl = new URL("/api/auth/get-session", request.url).toString();
        console.log("[Proxy] Fetching session from:", sessionUrl);

        const response = await fetch(sessionUrl, {
            headers: {
                cookie: request.headers.get("cookie") || "",
            },
        });

        const session = await response.json();
        console.log("[Proxy] Session check result:", session ? "Authenticated" : "No Session", session?.user?.email);

        if (!session) {
            console.log("[Proxy] No session found, redirecting to login");
            return NextResponse.redirect(new URL("/auth/login", request.url));
        }

        // 2. Enforce Email Verification
        // If user is logged in but not verified, force them to verification page
        if (!session.user.emailVerified) {
            console.log("[Proxy] Email not verified, redirecting to verify");
            return NextResponse.redirect(new URL("/auth/verify-email", request.url));
        }

        return NextResponse.next();
    } catch (error) {
        console.error("[Proxy] Session check failed:", error);
        // Fallback protection: if fetch fails, assume unauthenticated
        return NextResponse.redirect(new URL("/auth/login", request.url));
    }
}

export const config = {
    matcher: ["/dashboard/:path*", "/settings/:path*"],
};
