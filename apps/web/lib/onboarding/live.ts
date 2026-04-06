import type {
    BusinessOnboardingState,
    OnboardingStep,
} from "@repo/contracts/onboarding";
import { db, eq, and, ne } from "@repo/database";
import {
    invitation,
    location,
    member,
    organization,
    rosterEntry,
    shift,
} from "@repo/database/schema";
import type { AttendanceVerificationPolicy } from "@repo/config";
import { resolveActiveOrganizationId } from "@/lib/active-organization";
import { parseOrganizationMetadata } from "@/lib/organization-metadata";
import { getOnboardingHref } from "@/lib/routes";
import { requiresBusinessOnboarding } from "@/lib/server/organization-roles";
import { getApiSession } from "@/lib/server/auth-session";
import type { CurrentBusinessOnboardingStateResult } from "./data";

export async function getLiveBusinessOnboardingState(): Promise<CurrentBusinessOnboardingStateResult> {
    const session = await getApiSession();

    if (!session) {
        return {
            session: null,
            onboarding: null as BusinessOnboardingState | null,
            memberRole: null as string | null,
            shouldEnforceOnboarding: false,
            isMockMode: false,
        };
    }

    const activeOrgId = await resolveActiveOrganizationId(
        session.user.id,
        (session.session as any)?.activeOrganizationId as string | undefined
    );

    if (!activeOrgId) {
        return {
            session,
            onboarding: null as BusinessOnboardingState | null,
            memberRole: null as string | null,
            shouldEnforceOnboarding: false,
            isMockMode: false,
        };
    }

    const [
        org,
        currentMember,
        firstLocation,
        firstPublishedShift,
        firstDraftShift,
        firstRosterEntry,
        firstWorkerMember,
        firstManagerMember,
        firstManagerInvite,
    ] = await Promise.all([
        db.query.organization.findFirst({
            where: eq(organization.id, activeOrgId),
            columns: {
                id: true,
                name: true,
                timezone: true,
                attendanceVerificationPolicy: true,
                metadata: true,
                subscriptionStatus: true,
            },
        }),
        db.query.member.findFirst({
            where: and(
                eq(member.organizationId, activeOrgId),
                eq(member.userId, session.user.id)
            ),
            columns: {
                role: true,
            },
        }),
        db.query.location.findFirst({
            where: eq(location.organizationId, activeOrgId),
            columns: {
                id: true,
                name: true,
            },
        }),
        db.query.shift.findFirst({
            where: and(
                eq(shift.organizationId, activeOrgId),
                ne(shift.status, "draft")
            ),
            columns: {
                id: true,
                status: true,
            },
        }),
        db.query.shift.findFirst({
            where: and(
                eq(shift.organizationId, activeOrgId),
                eq(shift.status, "draft")
            ),
            columns: {
                id: true,
            },
        }),
        db.query.rosterEntry.findFirst({
            where: eq(rosterEntry.organizationId, activeOrgId),
            columns: {
                id: true,
            },
        }),
        db.query.member.findFirst({
            where: and(
                eq(member.organizationId, activeOrgId),
                ne(member.role, "owner"),
                ne(member.role, "admin"),
                ne(member.role, "manager")
            ),
            columns: {
                id: true,
            },
        }),
        db.query.member.findFirst({
            where: and(
                eq(member.organizationId, activeOrgId),
                eq(member.role, "manager")
            ),
            columns: {
                id: true,
            },
        }),
        db.query.invitation.findFirst({
            where: and(
                eq(invitation.organizationId, activeOrgId),
                eq(invitation.role, "manager"),
                eq(invitation.status, "pending")
            ),
            columns: {
                id: true,
            },
        }),
    ]);

    if (!org) {
        return {
            session,
            onboarding: null as BusinessOnboardingState | null,
            memberRole: currentMember?.role ?? null,
            shouldEnforceOnboarding: false,
            isMockMode: false,
        };
    }

    const metadata = parseOrganizationMetadata(org.metadata);
    const hasExistingOperationalSetup = Boolean(firstLocation) || Boolean(firstPublishedShift);
    const businessInformationComplete =
        Boolean(metadata.onboarding?.businessInformationCompleted) || hasExistingOperationalSetup;
    const billingHandled =
        Boolean(metadata.onboarding?.billingPromptHandled) ||
        org.subscriptionStatus === "active" ||
        org.subscriptionStatus === "trialing";
    const hasWorkforceAccess = Boolean(firstRosterEntry) || Boolean(firstWorkerMember);
    const hasPublishedShift = Boolean(firstPublishedShift);
    const hasDraftShift = Boolean(firstDraftShift);
    const hasManagerSupport = Boolean(firstManagerMember) || Boolean(firstManagerInvite);

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
            complete: Boolean(firstLocation),
            supportingText: firstLocation
                ? `Location ready: ${firstLocation.name}`
                : "Choose the main address",
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
    const memberRole = currentMember?.role ?? "member";
    const shouldEnforceOnboarding =
        requiresBusinessOnboarding(memberRole) && completedCount !== totalCount;

    return {
        session,
        memberRole,
        shouldEnforceOnboarding,
        isMockMode: false,
        onboarding: {
            orgId: activeOrgId,
            organizationName: org.name,
            organizationTimezone: org.timezone || "America/New_York",
            attendanceVerificationPolicy: (org.attendanceVerificationPolicy || "strict_geofence") as AttendanceVerificationPolicy,
            billingHandled,
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
