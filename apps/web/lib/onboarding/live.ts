import "server-only";

import type {
    BusinessOnboardingState,
    OnboardingStep,
} from "@repo/contracts/onboarding";
import { getOnboardingFacts } from "@/lib/api/organizations";
import type { AttendanceVerificationPolicy } from "@repo/config";
import { resolveActiveOrganizationId } from "@/lib/active-organization";
import { parseOrganizationMetadata } from "@/lib/organization-metadata";
import { getOnboardingHref } from "@/lib/routes";
import { requiresBusinessOnboarding } from "@/lib/server/organization-roles";
import { getApiSession } from "@/lib/server/auth-session";
import type { CurrentBusinessOnboardingStateResult } from "./types";

/** The API's answer when the caller isn't in the organization (apps/api/src/index.ts). */
const NOT_A_MEMBER = "Not a member of this organization";

type ApiSession = NonNullable<Awaited<ReturnType<typeof getApiSession>>>;
type ApiSessionWithActiveOrganization = ApiSession & {
    session?: ApiSession["session"] & {
        activeOrganizationId?: string | null;
    };
};

function getSessionActiveOrganizationId(session: ApiSession) {
    return (session as ApiSessionWithActiveOrganization).session?.activeOrganizationId ?? undefined;
}

export async function getLiveBusinessOnboardingState(_options?: {
    requestedStepId?: string;
}): Promise<CurrentBusinessOnboardingStateResult> {
    void _options;

    const session = await getApiSession();

    if (!session) {
        return {
            session: null,
            onboarding: null as BusinessOnboardingState | null,
            memberRole: null as string | null,
            shouldEnforceOnboarding: false,
        };
    }

    const activeOrgId = await resolveActiveOrganizationId(
        session.user.id,
        getSessionActiveOrganizationId(session)
    );

    if (!activeOrgId) {
        return {
            session,
            onboarding: null as BusinessOnboardingState | null,
            memberRole: null as string | null,
            shouldEnforceOnboarding: false,
        };
    }

    let facts: Awaited<ReturnType<typeof getOnboardingFacts>>;
    try {
        facts = await getOnboardingFacts(activeOrgId);
    } catch (error) {
        // A session pointing at an organization the user has since left: no onboarding to show.
        if (error instanceof Error && error.message === NOT_A_MEMBER) {
            return {
                session,
                onboarding: null as BusinessOnboardingState | null,
                memberRole: null as string | null,
                shouldEnforceOnboarding: false,
            };
        }
        throw error;
    }

    if (!facts) {
        return {
            session,
            onboarding: null as BusinessOnboardingState | null,
            memberRole: null as string | null,
            shouldEnforceOnboarding: false,
        };
    }

    const org = facts;
    const firstLocation = facts.hasLocation ? { name: facts.firstLocationName ?? "" } : null;

    const metadata = parseOrganizationMetadata(org.metadata);
    const hasExistingOperationalSetup = facts.hasLocation || facts.hasPublishedShift;
    const businessInformationComplete =
        Boolean(metadata.onboarding?.businessInformationCompleted) || hasExistingOperationalSetup;
    const billingHandled =
        Boolean(metadata.onboarding?.billingPromptHandled) ||
        org.subscriptionStatus === "active" ||
        org.subscriptionStatus === "trialing";
    const hasWorkforceAccess = facts.hasRosterEntry || facts.hasWorkerMember;
    const hasPublishedShift = facts.hasPublishedShift;
    const hasDraftShift = facts.hasDraftShift;
    const hasManagerSupport = facts.hasManagerMember || facts.hasManagerInvite;
    // A business that already published a shift finished onboarding before this
    // step existed; it keeps the defaults rather than being sent back through.
    const schedulingAnswered = Boolean(org.businessType) || hasPublishedShift;

    const steps: OnboardingStep[] = [
        {
            id: "account",
            title: "Account ready",
            description: "Your admin account, business workspace, and free trial are active.",
            href: getOnboardingHref({ step: "account" }),
            complete: true,
            supportingText: "Workspace created and admin access active",
        },
        {
            id: "business",
            title: "Business basics",
            description: "Set the business name, timezone, and clock-in rules that shape how the app operates.",
            href: getOnboardingHref({ step: "business" }),
            complete: businessInformationComplete,
            supportingText: businessInformationComplete
                ? "Business basics are ready"
                : "Business name, timezone, and clock-in rule",
        },
        {
            id: "location",
            title: "First location",
            description: "Add the first place where schedules will be created and workers usually clock in.",
            href: getOnboardingHref({ step: "location" }),
            complete: facts.hasLocation,
            supportingText: firstLocation
                ? `Location ready: ${firstLocation.name}`
                : "Choose the main address",
        },
        {
            id: "scheduling",
            title: "How you schedule",
            description: "Three quick answers that set up departments, the default view and open-shift approvals.",
            href: getOnboardingHref({ step: "scheduling" }),
            complete: schedulingAnswered,
            supportingText: schedulingAnswered
                ? "Scheduling defaults are set"
                : "Business type, weekly rhythm, open shifts",
        },
        {
            id: "workforce",
            title: "Workforce access",
            description: "Add or import the first workers who need mobile access before the operation goes live.",
            href: getOnboardingHref({ step: "workforce" }),
            complete: hasWorkforceAccess,
            supportingText: hasWorkforceAccess
                ? "Workforce setup has started"
                : "Add workers manually or import CSV",
        },
        {
            id: "first_shift",
            title: "First published shift",
            description: "Publishing the first live shift is the real onboarding finish line for the business.",
            href: getOnboardingHref({ step: "first_shift" }),
            complete: hasPublishedShift,
            supportingText: hasPublishedShift
                ? "A live shift has been published"
                : hasDraftShift
                    ? "A draft exists and is ready to publish"
                    : "Create and publish the first live shift",
        },
    ];

    const deferredSteps: OnboardingStep[] = [
        {
            id: "team_support",
            title: "Invite manager support",
            description: "Bring in another manager when the operation needs business-side help.",
            href: "/settings/team",
            complete: hasManagerSupport,
            supportingText: hasManagerSupport
                ? "Manager coverage has been added"
                : "Optional after go-live",
            optional: true,
        },
        {
            id: "billing",
            title: "Review billing",
            description: "Keep trial momentum first, then add billing details when you are ready.",
            href: "/settings/billing",
            complete: billingHandled,
            supportingText: billingHandled
                ? "Billing has been reviewed"
                : "Optional during trial",
            optional: true,
        },
    ];

    const completedCount = steps.filter((step) => step.complete).length;
    const totalCount = steps.length;
    const memberRole = facts.memberRole;
    const shouldEnforceOnboarding =
        requiresBusinessOnboarding(memberRole) && completedCount !== totalCount;

    return {
        session,
        memberRole,
        shouldEnforceOnboarding,
        onboarding: {
            orgId: activeOrgId,
            organizationName: org.name,
            organizationTimezone: org.timezone || "America/New_York",
            attendanceVerificationPolicy: (org.attendanceVerificationPolicy || "strict_geofence") as AttendanceVerificationPolicy,
            billingHandled,
            hasWorkforceAccess,
            hasPublishedShift,
            hasDraftShift,
            scheduling: {
                businessType: (org.businessType ?? null) as BusinessOnboardingState["scheduling"]["businessType"],
                scheduleStyle: org.scheduleStyle === "events" ? "events" : "steady",
                openShiftClaimPolicy: org.openShiftClaimPolicy === "auto" ? "auto" : "approval",
            },
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
