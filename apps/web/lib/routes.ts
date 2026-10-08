
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
export const SCHEDULER_PATH = "/schedule";
export const DASHBOARD_ONBOARDING_PATH = "/dashboard/onboarding";
export const WORKERS_PATH = "/workers";
export const REQUESTS_PATH = "/requests";
export const AUTH_LOGIN_PATH = "/auth/login";
export const AUTH_VERIFY_EMAIL_PATH = "/auth/verify-email";
export const AUTH_SIGN_UP_EMAIL_API_PATH = "/api/auth/sign-up/email";

/** The Timesheets page: who worked, clock-ins and hours. Planning lives in the Schedule. */
export function getDashboardShiftsHref() {
    return DASHBOARD_SHIFTS_PATH;
}

/**
 * The Schedule workspace. Omitted params mean the remembered view and site, on
 * the current week. `location` and `week` are what older links carry: a site
 * and any day in the week to open.
 */
export function getSchedulerHref(options?: {
    location?: string;
    /** Any local date (YYYY-MM-DD) inside the week to open. */
    week?: string;
    view?: "week" | "day" | "month";
    /** The day to open, or the day in the week to open. */
    date?: string;
    /** A site id, or "all". */
    site?: string;
}) {
    return buildHref(SCHEDULER_PATH, {
        view: options?.view,
        date: options?.date,
        site: options?.site,
        location: options?.location,
        week: options?.week,
    });
}

/** Time off, swaps, drops and open-shift claims waiting on a manager. */
export function getRequestsHref() {
    return REQUESTS_PATH;
}

export function isSchedulerPath(pathname: string) {
    return pathname === SCHEDULER_PATH || pathname.startsWith(`${SCHEDULER_PATH}/`);
}

export function getDashboardHistoryHref() {
    return getDashboardShiftsHref();
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

export function getWorkersHref(options?: {
    onboarding?: string;
}) {
    return buildHref(WORKERS_PATH, {
        onboarding: options?.onboarding,
    });
}

/** Where a shift's timesheet may send you back to: the Timesheets list or the Schedule. */
export function isSafeDashboardReturnPath(value?: string | null): value is string {
    if (!value) return false;
    if (value.startsWith(DASHBOARD_SHIFTS_PATH)) return true;
    return value === SCHEDULER_PATH || value.startsWith(`${SCHEDULER_PATH}?`) || value.startsWith(`${SCHEDULER_PATH}/`);
}

export function isOnboardingPath(pathname: string) {
    return pathname === DASHBOARD_ONBOARDING_PATH || pathname.startsWith(`${DASHBOARD_ONBOARDING_PATH}/`);
}

export function isWorkersPath(pathname: string) {
    return pathname === WORKERS_PATH || pathname.startsWith(`${WORKERS_PATH}/`);
}

export function isOnboardingExemptProtectedPath(pathname: string) {
    return (
        isOnboardingPath(pathname) ||
        isSchedulerPath(pathname) ||
        isWorkersPath(pathname)
    );
}
