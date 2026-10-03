import type { OnboardingFacts } from "@repo/contracts/onboarding";
import { and, db, eq, ne } from "@repo/database";
import {
    invitation,
    location,
    member,
    organization,
    rosterEntry,
    shift,
} from "@repo/database/schema";

/**
 * The raw facts onboarding is computed from. No copy, no links: the web app owns
 * how they read to the owner.
 */
export async function getOnboardingFacts(
    orgId: string,
    memberRole: string,
): Promise<OnboardingFacts | null> {
    const [
        org,
        firstLocation,
        firstPublishedShift,
        firstDraftShift,
        firstRosterEntry,
        firstWorkerMember,
        firstManagerMember,
        firstManagerInvite,
    ] = await Promise.all([
        db.query.organization.findFirst({
            where: eq(organization.id, orgId),
            columns: {
                id: true,
                name: true,
                timezone: true,
                attendanceVerificationPolicy: true,
                businessType: true,
                scheduleStyle: true,
                openShiftClaimPolicy: true,
                metadata: true,
                subscriptionStatus: true,
            },
        }),
        db.query.location.findFirst({
            where: eq(location.organizationId, orgId),
            columns: { id: true, name: true },
        }),
        db.query.shift.findFirst({
            where: and(eq(shift.organizationId, orgId), ne(shift.status, "draft")),
            columns: { id: true },
        }),
        db.query.shift.findFirst({
            where: and(eq(shift.organizationId, orgId), eq(shift.status, "draft")),
            columns: { id: true },
        }),
        db.query.rosterEntry.findFirst({
            where: eq(rosterEntry.organizationId, orgId),
            columns: { id: true },
        }),
        db.query.member.findFirst({
            where: and(
                eq(member.organizationId, orgId),
                ne(member.role, "owner"),
                ne(member.role, "admin"),
                ne(member.role, "manager"),
            ),
            columns: { id: true },
        }),
        db.query.member.findFirst({
            where: and(eq(member.organizationId, orgId), eq(member.role, "manager")),
            columns: { id: true },
        }),
        db.query.invitation.findFirst({
            where: and(
                eq(invitation.organizationId, orgId),
                eq(invitation.role, "manager"),
                eq(invitation.status, "pending"),
            ),
            columns: { id: true },
        }),
    ]);

    if (!org) {
        return null;
    }

    return {
        orgId: org.id,
        name: org.name,
        timezone: org.timezone,
        attendanceVerificationPolicy: org.attendanceVerificationPolicy,
        businessType: (org.businessType ?? null) as OnboardingFacts["businessType"],
        scheduleStyle: org.scheduleStyle,
        openShiftClaimPolicy: org.openShiftClaimPolicy,
        metadata: org.metadata,
        subscriptionStatus: org.subscriptionStatus,
        memberRole,
        firstLocationName: firstLocation?.name ?? null,
        hasLocation: Boolean(firstLocation),
        hasPublishedShift: Boolean(firstPublishedShift),
        hasDraftShift: Boolean(firstDraftShift),
        hasRosterEntry: Boolean(firstRosterEntry),
        hasWorkerMember: Boolean(firstWorkerMember),
        hasManagerMember: Boolean(firstManagerMember),
        hasManagerInvite: Boolean(firstManagerInvite),
    };
}
