import type { ShiftLayout } from "@/lib/types";
import type { ShiftDashboardTab } from "@/lib/shifts/weekly-grid";

type QueryValue = string | number | boolean | null | undefined;

function buildHref(pathname: string, params?: Record<string, QueryValue>) {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params ?? {})) {
        if (value === undefined || value === null || value === false || value === "") {
            continue;
        }

        searchParams.set(key, String(value));
    }

    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
}

export const DASHBOARD_SHIFTS_PATH = "/dashboard/shifts";
export const DASHBOARD_SCHEDULE_CREATE_PATH = "/dashboard/schedule/create";
export const DASHBOARD_ONBOARDING_PATH = "/dashboard/onboarding";
export const ROSTERS_PATH = "/rosters";
export const AUTH_LOGIN_PATH = "/auth/login";
export const AUTH_VERIFY_EMAIL_PATH = "/auth/verify-email";
export const AUTH_SIGN_UP_EMAIL_API_PATH = "/api/auth/sign-up/email";

export function getDashboardShiftsHref(options?: {
    view?: ShiftDashboardTab;
    layout?: ShiftLayout;
}) {
    return buildHref(DASHBOARD_SHIFTS_PATH, {
        view: options?.view,
        layout: options?.layout,
    });
}

export function getDashboardHistoryHref() {
    return getDashboardShiftsHref({ view: "past" });
}

export function getShiftTimesheetHref(
    shiftId: string,
    options?: {
        returnTo?: string;
    },
) {
    return buildHref(`${DASHBOARD_SHIFTS_PATH}/${shiftId}/timesheet`, {
        returnTo: options?.returnTo,
    });
}

export function getCreateScheduleHref() {
    return DASHBOARD_SCHEDULE_CREATE_PATH;
}

export function getAuthLoginHref(options?: {
    callbackURL?: string;
}) {
    return buildHref(AUTH_LOGIN_PATH, {
        callbackURL: options?.callbackURL,
    });
}

export function getVerifyEmailHref(options?: {
    email?: string;
    callbackURL?: string;
}) {
    return buildHref(AUTH_VERIFY_EMAIL_PATH, {
        email: options?.email,
        callbackURL: options?.callbackURL,
    });
}

export function getOnboardingHref(options?: {
    step?: string;
}) {
    return buildHref(DASHBOARD_ONBOARDING_PATH, {
        step: options?.step,
    });
}

export function getRosterHref(options?: {
    onboarding?: string;
}) {
    return buildHref(ROSTERS_PATH, {
        onboarding: options?.onboarding,
    });
}

export function isSafeDashboardReturnPath(value?: string | null): value is string {
    return Boolean(value && value.startsWith(DASHBOARD_SHIFTS_PATH));
}

export function isOnboardingPath(pathname: string) {
    return pathname === DASHBOARD_ONBOARDING_PATH || pathname.startsWith(`${DASHBOARD_ONBOARDING_PATH}/`);
}

export function isCreateSchedulePath(pathname: string) {
    return pathname === DASHBOARD_SCHEDULE_CREATE_PATH || pathname.startsWith(`${DASHBOARD_SCHEDULE_CREATE_PATH}/`);
}

export function isRosterPath(pathname: string) {
    return pathname === ROSTERS_PATH || pathname.startsWith(`${ROSTERS_PATH}/`);
}

export function isOnboardingExemptProtectedPath(pathname: string) {
    return (
        isOnboardingPath(pathname) ||
        isCreateSchedulePath(pathname) ||
        isRosterPath(pathname)
    );
}
