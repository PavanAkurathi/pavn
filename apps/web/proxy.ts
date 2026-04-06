// apps/web/proxy.ts
// Next.js 16 uses proxy.ts for request interception on protected routes.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getApiBaseUrl } from "@/lib/constants";
import { isOnboardingEnforcementDisabled } from "@/lib/onboarding/config";
import {
    AUTH_SIGN_UP_EMAIL_API_PATH,
    getAuthLoginHref,
    getOnboardingHref,
    getVerifyEmailHref,
    isOnboardingExemptProtectedPath,
    isOnboardingPath,
} from "@/lib/routes";

type ProxySession = {
    user: {
        email: string;
        emailVerified: boolean;
    };
} | null;

type OnboardingStatus = {
    hasOnboarding: boolean;
    isComplete: boolean;
    requiresOnboarding: boolean;
};

function getRequestCookieHeader(request: NextRequest) {
    return request.headers.get("cookie") || "";
}

function getCallbackPath(request: NextRequest) {
    return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

function redirectToLogin(request: NextRequest) {
    const redirectUrl = new URL(getAuthLoginHref({
        callbackURL: getCallbackPath(request),
    }), request.url);

    return NextResponse.redirect(redirectUrl);
}

function redirectToVerifyEmail(request: NextRequest, email: string) {
    const redirectUrl = new URL(getVerifyEmailHref({
        email,
        callbackURL: getCallbackPath(request),
    }), request.url);

    return NextResponse.redirect(redirectUrl);
}

function redirectToOnboarding(request: NextRequest) {
    return NextResponse.redirect(new URL(getOnboardingHref(), request.url));
}

function shouldAllowOnboardingMock(request: NextRequest) {
    if (!isOnboardingPath(request.nextUrl.pathname)) {
        return false;
    }

    const envMockEnabled =
        process.env.PAVN_ONBOARDING_MOCKS === "1" ||
        process.env.PAVN_ONBOARDING_MOCKS === "true";
    const explicitMockEnabled = request.nextUrl.searchParams.get("mock") === "1";

    return envMockEnabled || explicitMockEnabled;
}

function shouldEnforceOnboardingForRequest(request: NextRequest) {
    return (
        !isOnboardingEnforcementDisabled() &&
        !shouldAllowOnboardingMock(request) &&
        !isOnboardingExemptProtectedPath(request.nextUrl.pathname)
    );
}

async function fetchProxySession(request: NextRequest): Promise<ProxySession> {
    const sessionUrl = new URL("/api/auth/get-session", getApiBaseUrl()).toString();
    const response = await fetch(sessionUrl, {
        headers: {
            accept: "application/json",
            cookie: getRequestCookieHeader(request),
        },
        cache: "no-store",
    });

    if (!response.ok) {
        if (response.status === 401) {
            return null;
        }

        throw new Error(`[Proxy] Session check failed (${response.status})`);
    }

    const payload = (await response.json()) as ProxySession;
    return payload ?? null;
}

async function fetchOnboardingStatus(request: NextRequest): Promise<OnboardingStatus | null> {
    const onboardingUrl = new URL("/api/internal/onboarding-status", request.url);
    const response = await fetch(onboardingUrl.toString(), {
        headers: {
            cookie: getRequestCookieHeader(request),
        },
        cache: "no-store",
    });

    if (!response.ok) {
        return null;
    }

    return (await response.json()) as OnboardingStatus;
}

function handleRegistrationGeoBlock(request: NextRequest) {
    if (request.nextUrl.pathname !== AUTH_SIGN_UP_EMAIL_API_PATH || request.method !== "POST") {
        return null;
    }

    const country = request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry");

    if (country && !["US", "CA"].includes(country)) {
        return NextResponse.json(
            { message: "Registration is currently limited to the US and Canada." },
            { status: 403 },
        );
    }

    return NextResponse.next();
}

export default async function proxy(request: NextRequest) {
    const registrationResponse = handleRegistrationGeoBlock(request);
    if (registrationResponse) {
        return registrationResponse;
    }

    try {
        const session = await fetchProxySession(request);

        if (!session) {
            return redirectToLogin(request);
        }

        if (!session.user.emailVerified) {
            return redirectToVerifyEmail(request, session.user.email);
        }

        if (shouldEnforceOnboardingForRequest(request)) {
            const onboardingStatus = await fetchOnboardingStatus(request);

            if (
                onboardingStatus?.hasOnboarding &&
                onboardingStatus.requiresOnboarding &&
                !onboardingStatus.isComplete
            ) {
                return redirectToOnboarding(request);
            }
        }

        return NextResponse.next();
    } catch (error) {
        console.error("[Proxy] Protected route check failed:", error);
        return redirectToLogin(request);
    }
}

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/settings/:path*",
        "/rosters/:path*",
        "/reports/:path*",
        "/workers/:path*",
        "/api/auth/sign-up/email",
    ],
};
