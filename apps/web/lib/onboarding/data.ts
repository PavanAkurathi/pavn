import type { Session } from "@repo/auth/client";
import type {
    BusinessOnboardingState,
    OnboardingStep,
} from "@repo/contracts/onboarding";
import type { AttendanceVerificationPolicy } from "@repo/config";

export type CurrentBusinessOnboardingStateResult = {
    session: Session | null;
    onboarding: BusinessOnboardingState | null;
    memberRole: string | null;
    shouldEnforceOnboarding: boolean;
    isMockMode: boolean;
};

type MockStepId = "business" | "location" | "workforce" | "first_shift";

const MOCK_ORG_ID = "org_mock_workers_hive";
const MOCK_ATTENDANCE_POLICY: AttendanceVerificationPolicy = "strict_geofence";
const ORDERED_STEP_IDS: MockStepId[] = ["business", "location", "workforce", "first_shift"];

const MOCK_SESSION = {
    user: {
        id: "user_mock_owner",
        email: "owner@workershive.demo",
        emailVerified: true,
        name: "Avery Kumar",
        image: null,
        createdAt: new Date("2026-04-01T12:00:00.000Z"),
        updatedAt: new Date("2026-04-01T12:00:00.000Z"),
    },
    session: {
        id: "session_mock_owner",
        userId: "user_mock_owner",
        expiresAt: new Date("2026-12-31T23:59:59.000Z"),
        token: "mock-session-token",
        createdAt: new Date("2026-04-01T12:00:00.000Z"),
        updatedAt: new Date("2026-04-01T12:00:00.000Z"),
        activeOrganizationId: MOCK_ORG_ID,
    },
} as Session;

function resolveMockStep(requestedStepId?: string): MockStepId {
    if (requestedStepId && ORDERED_STEP_IDS.includes(requestedStepId as MockStepId)) {
        return requestedStepId as MockStepId;
    }

    return "business";
}

function createMockStep(
    step: {
        id: "account" | MockStepId;
        title: string;
        description: string;
        supportingText: string;
        complete: boolean;
    },
): OnboardingStep {
    return {
        id: step.id,
        title: step.title,
        description: step.description,
        href: step.id === "account" ? "/dashboard/onboarding" : `/dashboard/onboarding?step=${step.id}&mock=1`,
        complete: step.complete,
        supportingText: step.supportingText,
    };
}

export function isOnboardingMockModeEnabled(forceMock?: boolean) {
    if (forceMock) {
        return true;
    }

    const value = process.env.PAVN_ONBOARDING_MOCKS;
    return value === "1" || value === "true";
}

export function getMockBusinessOnboardingState(requestedStepId?: string): CurrentBusinessOnboardingStateResult {
    const activeStep = resolveMockStep(requestedStepId);
    const activeIndex = ORDERED_STEP_IDS.indexOf(activeStep);

    const hasBusinessBasics = activeIndex >= 1;
    const hasLocation = activeIndex >= 2;
    const hasWorkforceAccess = activeIndex >= 3;
    const hasDraftShift = activeStep === "first_shift";
    const hasPublishedShift = false;

    const steps: OnboardingStep[] = [
        createMockStep({
            id: "account",
            title: "Account ready",
            description: "Your admin account, business workspace, and free trial are active.",
            complete: true,
            supportingText: "Workspace created and admin access active",
        }),
        createMockStep({
            id: "business",
            title: "Business basics",
            description: "Set the business name, timezone, and clock-in rules that shape how the app operates.",
            complete: hasBusinessBasics,
            supportingText: hasBusinessBasics
                ? "Business basics are ready"
                : "Business name, timezone, and clock-in rule",
        }),
        createMockStep({
            id: "location",
            title: "First location",
            description: "Add the first place where schedules will be created and workers usually clock in.",
            complete: hasLocation,
            supportingText: hasLocation
                ? "Location ready: Downtown Ballroom"
                : "Choose the main address",
        }),
        createMockStep({
            id: "workforce",
            title: "Workforce access",
            description: "Add or import the first workers who need mobile access before the operation goes live.",
            complete: hasWorkforceAccess,
            supportingText: hasWorkforceAccess
                ? "Workforce setup has started"
                : "Add workers manually or import CSV",
        }),
        createMockStep({
            id: "first_shift",
            title: "First published shift",
            description: "Publishing the first live shift is the real onboarding finish line for the business.",
            complete: hasPublishedShift,
            supportingText: hasDraftShift
                ? "A draft exists and is ready to publish"
                : "Create and publish the first live shift",
        }),
    ];

    const deferredSteps: OnboardingStep[] = [
        {
            id: "team_support",
            title: "Invite manager support",
            description: "Bring in another manager when the operation needs business-side help.",
            href: "/settings/team",
            complete: false,
            supportingText: "Optional after go-live",
            optional: true,
        },
        {
            id: "billing",
            title: "Review billing",
            description: "Keep trial momentum first, then add billing details when you are ready.",
            href: "/settings/billing",
            complete: false,
            supportingText: "Optional during trial",
            optional: true,
        },
    ];

    const completedCount = steps.filter((step) => step.complete).length;
    const totalCount = steps.length;

    return {
        session: MOCK_SESSION,
        memberRole: "owner",
        shouldEnforceOnboarding: true,
        isMockMode: true,
        onboarding: {
            orgId: MOCK_ORG_ID,
            organizationName: "Workers Hive Demo",
            organizationTimezone: "America/New_York",
            attendanceVerificationPolicy: MOCK_ATTENDANCE_POLICY,
            billingHandled: false,
            hasWorkforceAccess,
            hasPublishedShift,
            hasDraftShift,
            registrationSummary: [
                "Your admin account is created",
                "Your business workspace is created",
                "Your admin access is active",
                "Your free trial has started",
            ],
            steps,
            deferredSteps,
            completedCount,
            totalCount,
            isComplete: completedCount === totalCount,
            settingsHref: "/settings/business",
        },
    };
}
