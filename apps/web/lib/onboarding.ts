import { auth } from "@repo/auth";
import { db, eq, and, ne } from "@repo/database";
import {
    invitation,
    location,
    member,
    organization,
    rosterEntry,
    shift,
    workerRole,
} from "@repo/database/schema";
import { headers } from "next/headers";

export type OnboardingStep = {
    id: string;
    title: string;
    description: string;
    href: string;
    complete: boolean;
    supportingText: string;
};

export type BusinessOnboardingState = {
    orgId: string;
    organizationName: string;
    registrationSummary: string[];
    steps: OnboardingStep[];
    completedCount: number;
    totalCount: number;
    isComplete: boolean;
    settingsHref: string;
};

async function resolveActiveOrgId(userId: string, activeOrgId?: string) {
    if (activeOrgId) {
        return activeOrgId;
    }

    const firstMembership = await db.query.member.findFirst({
        where: eq(member.userId, userId),
        columns: {
            organizationId: true,
        },
    });

    return firstMembership?.organizationId ?? null;
}

export async function getCurrentBusinessOnboardingState() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return { session: null, onboarding: null as BusinessOnboardingState | null };
    }

    const activeOrgId = await resolveActiveOrgId(
        session.user.id,
        (session.session as any)?.activeOrganizationId as string | undefined
    );

    if (!activeOrgId) {
        return { session, onboarding: null as BusinessOnboardingState | null };
    }

    const [
        org,
        firstLocation,
        memberRows,
        firstInvitation,
        rosterRows,
        firstWorkerRole,
        firstPublishedShift,
    ] = await Promise.all([
        db.query.organization.findFirst({
            where: eq(organization.id, activeOrgId),
            columns: {
                id: true,
                name: true,
            },
        }),
        db.query.location.findFirst({
            where: eq(location.organizationId, activeOrgId),
            columns: {
                id: true,
                name: true,
            },
        }),
        db.query.member.findMany({
            where: eq(member.organizationId, activeOrgId),
            columns: {
                role: true,
                jobTitle: true,
            },
        }),
        db.query.invitation.findFirst({
            where: eq(invitation.organizationId, activeOrgId),
            columns: {
                id: true,
            },
        }),
        db.query.rosterEntry.findMany({
            where: eq(rosterEntry.organizationId, activeOrgId),
            columns: {
                id: true,
                jobTitle: true,
                roles: true,
            },
        }),
        db.query.workerRole.findFirst({
            where: eq(workerRole.organizationId, activeOrgId),
            columns: {
                id: true,
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
        return { session, onboarding: null as BusinessOnboardingState | null };
    }

    const activeWorkerMembers = memberRows.filter(
        (row) => !["admin", "owner"].includes(row.role)
    );
    const hasTeam = activeWorkerMembers.length > 0 || Boolean(firstInvitation) || rosterRows.length > 0;
    const hasAssignedRoles =
        Boolean(firstWorkerRole) ||
        activeWorkerMembers.some((row) => Boolean(row.jobTitle)) ||
        rosterRows.some((row) => Boolean(row.jobTitle) || (row.roles?.length ?? 0) > 0);

    const steps: OnboardingStep[] = [
        {
            id: "location",
            title: "Add your first location",
            description: "Schedules and clock-in verification depend on having at least one location.",
            href: "/settings/locations",
            complete: Boolean(firstLocation),
            supportingText: firstLocation
                ? `Location ready: ${firstLocation.name}`
                : "No locations added yet",
        },
        {
            id: "team",
            title: "Add your team",
            description: "Invite workers or import your roster so you have people to schedule.",
            href: "/rosters",
            complete: hasTeam,
            supportingText: hasTeam
                ? "Workers, invites, or roster entries exist"
                : "No workers, invites, or roster imports yet",
        },
        {
            id: "roles",
            title: "Assign worker roles",
            description: "Set the roles you schedule against, like cashier, security, cleaner, or custom roles.",
            href: "/rosters",
            complete: hasAssignedRoles,
            supportingText: hasAssignedRoles
                ? "At least one worker role or job title is set"
                : "No worker roles have been assigned yet",
        },
        {
            id: "schedule",
            title: "Publish your first shift",
            description: "Create the first live schedule block so your business becomes operational.",
            href: "/dashboard/schedule/create",
            complete: Boolean(firstPublishedShift),
            supportingText: firstPublishedShift
                ? `First live shift created (${firstPublishedShift.status})`
                : "No published or assigned shifts yet",
        },
    ];

    const completedCount = steps.filter((step) => step.complete).length;

    return {
        session,
        onboarding: {
            orgId: activeOrgId,
            organizationName: org.name,
            registrationSummary: [
                "Your manager account is created",
                "Your business workspace is created",
                "Your admin access is active",
                "Your free trial has started",
            ],
            steps,
            completedCount,
            totalCount: steps.length,
            isComplete: completedCount === steps.length,
            settingsHref: "/settings/business",
        },
    };
}
