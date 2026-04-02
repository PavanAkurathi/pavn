import { auth } from "@repo/auth";
import { db, eq, and, ne } from "@repo/database";
import {
    location,
    member,
    organization,
    shift,
} from "@repo/database/schema";
import { headers } from "next/headers";
import type { AttendanceVerificationPolicy } from "@repo/config";
import { resolveActiveOrganizationId } from "@/lib/active-organization";
import { parseOrganizationMetadata } from "@/lib/organization-metadata";
import { requiresBusinessOnboarding } from "@/lib/server/organization-roles";

export type OnboardingStep = {
    id: string;
    title: string;
    description: string;
    href: string;
    complete: boolean;
    supportingText: string;
    optional?: boolean;
};

export type BusinessOnboardingState = {
    orgId: string;
    organizationName: string;
    organizationTimezone: string;
    attendanceVerificationPolicy: AttendanceVerificationPolicy;
    billingHandled: boolean;
    registrationSummary: string[];
    steps: OnboardingStep[];
    completedCount: number;
    totalCount: number;
    isComplete: boolean;
    settingsHref: string;
};

export async function getCurrentBusinessOnboardingState() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

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
        (session.session as any)?.activeOrganizationId as string | undefined
    );

    if (!activeOrgId) {
        return {
            session,
            onboarding: null as BusinessOnboardingState | null,
            memberRole: null as string | null,
            shouldEnforceOnboarding: false,
        };
    }

    const [
        org,
        currentMember,
        firstLocation,
        firstPublishedShift,
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
    ]);

    if (!org) {
        return {
            session,
            onboarding: null as BusinessOnboardingState | null,
            memberRole: currentMember?.role ?? null,
            shouldEnforceOnboarding: false,
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

    const steps: OnboardingStep[] = [
        {
            id: "account",
            title: "Account ready",
            description: "Your admin account, business workspace, and free trial are active.",
            href: "/dashboard/onboarding?step=account",
            complete: true,
            supportingText: "Workspace created and admin access active",
        },
        {
            id: "business",
            title: "Business profile",
            description: "Set the business name, timezone, and clock-in rules that shape how the app operates.",
            href: "/dashboard/onboarding?step=business",
            complete: businessInformationComplete,
            supportingText: businessInformationComplete
                ? "Business profile ready"
                : "Business name, timezone, and clock-in rule",
        },
        {
            id: "location",
            title: "First location",
            description: "Add the first place where schedules will be created and workers usually clock in.",
            href: "/dashboard/onboarding?step=location",
            complete: Boolean(firstLocation),
            supportingText: firstLocation
                ? `Location ready: ${firstLocation.name}`
                : "Choose the main address",
        },
    ];

    const completedCount = steps.filter((step) => step.complete).length;
    const totalCount = steps.length;
    const memberRole = currentMember?.role ?? "member";
    const shouldEnforceOnboarding = requiresBusinessOnboarding(memberRole) && completedCount !== totalCount;

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
            registrationSummary: [
                "Your admin account is created",
                "Your business workspace is created",
                "Your admin access is active",
                "Your free trial has started",
            ],
            steps,
            completedCount,
            totalCount,
            isComplete: completedCount === totalCount,
            settingsHref: "/settings/business",
        },
    };
}
