import { and, eq } from "@repo/database";
import { db } from "@repo/database";
import { invitation, organization, user } from "@repo/database/schema";

export type BusinessTeamInvitationRole = "admin" | "manager";

export type BusinessInvitationState = {
    id: string;
    email: string;
    role: BusinessTeamInvitationRole;
    status: string;
    expiresAt: Date;
    organizationId: string;
    organizationName: string;
    organizationSlug: string | null;
    inviterId: string;
    existingUserId: string | null;
    existingUserName: string | null;
    existingUserVerified: boolean;
    isExpired: boolean;
};

function isBusinessTeamInvitationRole(
    role: string | null | undefined,
): role is BusinessTeamInvitationRole {
    return role === "admin" || role === "manager";
}

export function getWebAppUrl(): string {
    return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
        /\/+$/,
        "",
    );
}

export function buildBusinessActivationPath(invitationId: string): string {
    const search = new URLSearchParams({ invitationId });
    return `/auth/activate?${search.toString()}`;
}

export function buildBusinessInviteUrl(
    invitationId: string,
    hasExistingAccount: boolean,
): string {
    const appUrl = getWebAppUrl();
    const activationPath = buildBusinessActivationPath(invitationId);

    if (!hasExistingAccount) {
        return new URL(activationPath, appUrl).toString();
    }

    const loginUrl = new URL("/auth/login", appUrl);
    loginUrl.searchParams.set("callbackURL", activationPath);
    return loginUrl.toString();
}

export async function getBusinessInvitationState(
    invitationId: string,
): Promise<BusinessInvitationState | null> {
    const invitationRecord = await db.query.invitation.findFirst({
        where: and(eq(invitation.id, invitationId), eq(invitation.status, "pending")),
        columns: {
            id: true,
            email: true,
            role: true,
            status: true,
            expiresAt: true,
            organizationId: true,
            inviterId: true,
        },
    });

    if (!invitationRecord) {
        return null;
    }

    const [organizationRecord, existingUser] = await Promise.all([
        db.query.organization.findFirst({
            where: eq(organization.id, invitationRecord.organizationId),
            columns: {
                id: true,
                name: true,
                slug: true,
            },
        }),
        db.query.user.findFirst({
            where: eq(user.email, invitationRecord.email),
            columns: {
                id: true,
                name: true,
                emailVerified: true,
            },
        }),
    ]);

    if (!organizationRecord) {
        return null;
    }

    return {
        id: invitationRecord.id,
        email: invitationRecord.email,
        role: isBusinessTeamInvitationRole(invitationRecord.role)
            ? invitationRecord.role
            : "manager",
        status: invitationRecord.status,
        expiresAt: invitationRecord.expiresAt,
        organizationId: invitationRecord.organizationId,
        organizationName: organizationRecord.name,
        organizationSlug: organizationRecord.slug,
        inviterId: invitationRecord.inviterId,
        existingUserId: existingUser?.id ?? null,
        existingUserName: existingUser?.name ?? null,
        existingUserVerified: existingUser?.emailVerified ?? false,
        isExpired: invitationRecord.expiresAt < new Date(),
    };
}
