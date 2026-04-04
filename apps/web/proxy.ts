// apps/web/proxy.ts
// latestnextjs renamed middleware to proxy
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getApiBaseUrl } from "@/lib/constants";
import { isOnboardingEnforcementDisabled } from "@/lib/onboarding/config";

export default async function proxy(request: NextRequest) {
    // 1. Geo-Blocking for Registration (Store Bouncer)
    const { pathname } = request.nextUrl;
    if (isOnboardingEnforcementDisabled()) {
        return NextResponse.next();
    }

    const onboardingMockRequested =
        (process.env.PAVN_ONBOARDING_MOCKS === "1" || process.env.PAVN_ONBOARDING_MOCKS === "true") &&
        (pathname === "/dashboard/onboarding" || pathname.startsWith("/dashboard/onboarding/"));
    const explicitOnboardingMockRequested =
        request.nextUrl.searchParams.get("mock") === "1" &&
        (pathname === "/dashboard/onboarding" || pathname.startsWith("/dashboard/onboarding/"));

    if (onboardingMockRequested || explicitOnboardingMockRequested) {
        return NextResponse.next();
    }

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
        const sessionUrl = new URL("/api/auth/get-session", getApiBaseUrl()).toString();

        // console.log("[Proxy] Fetching session from:", sessionUrl);

        const response = await fetch(sessionUrl, {
            headers: {
                accept: "application/json",
                cookie: request.headers.get("cookie") || "",
            },
        });

        const session = await response.json();
        // console.log("[Proxy] Session check result:", session ? "Authenticated" : "No Session", session?.user?.email);

        if (!session) {
            const redirectUrl = new URL("/auth/login", request.url);
            const callbackPath = `${pathname}${request.nextUrl.search}`;
            redirectUrl.searchParams.set("callbackURL", callbackPath);
            return NextResponse.redirect(redirectUrl);
        }

        // 2. Enforce Email Verification
        // If user is logged in but not verified, force them to verification page
        if (!session.user.emailVerified) {
            const redirectUrl = new URL("/auth/verify-email", request.url);
            redirectUrl.searchParams.set("email", session.user.email);
            redirectUrl.searchParams.set("callbackURL", `${pathname}${request.nextUrl.search}`);
            return NextResponse.redirect(redirectUrl);
        }

        const onboardingAllowedPath =
            pathname === "/dashboard/onboarding" ||
            pathname.startsWith("/dashboard/onboarding/") ||
            pathname === "/dashboard/schedule/create" ||
            pathname.startsWith("/dashboard/schedule/create/") ||
            pathname === "/rosters" ||
            pathname.startsWith("/rosters/");

        const shouldEnforceOnboarding = !onboardingAllowedPath;

        if (shouldEnforceOnboarding) {
            const onboardingUrl = new URL("/api/internal/onboarding-status", request.url);

            const onboardingResponse = await fetch(onboardingUrl.toString(), {
                headers: {
                    cookie: request.headers.get("cookie") || "",
                },
            });

            if (onboardingResponse.ok) {
                const onboardingStatus = await onboardingResponse.json() as {
                    hasOnboarding: boolean;
                    isComplete: boolean;
                    requiresOnboarding: boolean;
                };

                if (onboardingStatus.hasOnboarding && onboardingStatus.requiresOnboarding && !onboardingStatus.isComplete) {
                    const redirectUrl = new URL("/dashboard/onboarding", request.url);
                    return NextResponse.redirect(redirectUrl);
                }
            }
        }

        return NextResponse.next();
    } catch (error) {
        console.error("[Proxy] Session check failed:", error);
        // Fallback protection: if fetch fails, assume unauthenticated
        const redirectUrl = new URL("/auth/login", request.url);
        redirectUrl.searchParams.set("callbackURL", `${pathname}${request.nextUrl.search}`);
        return NextResponse.redirect(redirectUrl);
    }
}

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/settings/:path*",
        "/rosters/:path*",
        "/reports/:path*",
        "/workers/:path*",
    ],
};
