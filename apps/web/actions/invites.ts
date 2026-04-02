"use server";

import { auth, sendSMS } from "@repo/auth";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { invitation, member, user } from "@repo/database/schema";
import { eq, and } from "@repo/database";
import { revalidatePath } from "next/cache";
import { sendInvite } from "@repo/email";
import {
    buildBusinessInviteUrl,
    getBusinessInvitationState,
} from "@/lib/server/business-invitations";
import { isAdminOrganizationRole } from "@/lib/server/organization-roles";

export async function resendInvite(memberId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) throw new Error("Unauthorized");
    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    const activeOrgId = (session.session as any).activeOrganizationId as string | undefined;

    // Fetch Member & User details
    const memberRecord = await db.query.member.findFirst({
        where: and(
            eq(member.id, memberId),
            eq(member.organizationId, activeOrgId || "")
        ),
        with: {
            user: true
        }
    });

    if (!memberRecord || !memberRecord.user) {
        throw new Error("Member not found");
    }

    const { phoneNumber, email } = memberRecord.user;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const methods: string[] = [];

    if (email && process.env.RESEND_API_KEY) {
        await sendInvite({
            email,
            role: memberRecord.role,
            inviteUrl: `${appUrl}/auth/login`,
            actionLabel: "Go to login",
        });
        methods.push("email");
    }

    if (phoneNumber) {
        const loginUrl = `${appUrl}/auth/login`;
        const message = `REMINDER: You've been invited to join your team on Workers Hive. Sign in here: ${loginUrl}`;

        try {
            await sendSMS(phoneNumber, message);
            methods.push("sms");
        } catch (e) {
            console.error("Failed to resend SMS", e);
            if (methods.length === 0) {
                throw new Error("Failed to send invite");
            }
        }
    }

    if (methods.length === 0) {
        throw new Error("No invite delivery method is configured for this member");
    }

    return { success: true, method: methods.join("+") };
}

export async function deleteMemberAction(memberId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) throw new Error("Unauthorized");
    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    const activeOrgId = (session.session as any).activeOrganizationId as string | undefined;

    // Verify admin/owner permission
    const currentMember = await db.query.member.findFirst({
        where: and(
            eq(member.userId, session.user.id),
            eq(member.organizationId, activeOrgId || "")
        )
    });

    if (!currentMember || !isAdminOrganizationRole(currentMember.role)) {
        throw new Error("Permission denied");
    }

    await db.delete(member)
        .where(and(
            eq(member.id, memberId),
            eq(member.organizationId, activeOrgId || "")
        ));

    revalidatePath("/settings/team");
    return { success: true };
}

async function getTeamAdminContext() {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({
        headers: requestHeaders
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    const activeOrgId = (session.session as any).activeOrganizationId as string | undefined;
    if (!activeOrgId) {
        throw new Error("No active organization");
    }

    const currentMember = await db.query.member.findFirst({
        where: and(
            eq(member.userId, session.user.id),
            eq(member.organizationId, activeOrgId)
        ),
    });

    if (!currentMember || !isAdminOrganizationRole(currentMember.role)) {
        throw new Error("Permission denied");
    }

    return {
        requestHeaders,
        activeOrgId,
    };
}

export async function resendTeamInvite(invitationId: string) {
    const { requestHeaders, activeOrgId } = await getTeamAdminContext();

    const invitationState = await getBusinessInvitationState(invitationId);
    if (!invitationState || invitationState.organizationId !== activeOrgId) {
        throw new Error("Invitation not found");
    }

    const invitationRecord = await auth.api.createInvitation({
        headers: requestHeaders,
        body: {
            organizationId: activeOrgId,
            email: invitationState.email,
            role: invitationState.role,
            resend: true,
        },
    }) as { id?: string; invitation?: { id?: string } };

    const effectiveInvitationId = invitationRecord.id || invitationRecord.invitation?.id || invitationId;
    const existingUser = await db.query.user.findFirst({
        where: eq(user.email, invitationState.email),
        columns: {
            id: true,
            phoneNumber: true,
        },
    });
    const inviteUrl = buildBusinessInviteUrl(effectiveInvitationId, Boolean(existingUser));

    await sendInvite({
        email: invitationState.email,
        role: invitationState.role,
        inviteUrl,
        organizationName: invitationState.organizationName,
        actionLabel: existingUser ? "Review your invitation" : "Activate your account",
    });

    if (existingUser?.phoneNumber) {
        try {
            await sendSMS(
                existingUser.phoneNumber,
                `Reminder: your ${invitationState.organizationName} invitation is ready on Workers Hive. Open: ${inviteUrl}`
            );
        } catch (error) {
            console.error("[TeamInvite] Failed to resend SMS reminder:", error);
        }
    }

    revalidatePath("/settings");
    revalidatePath("/settings/team");
    return { success: true };
}

export async function cancelTeamInvite(invitationId: string) {
    const { requestHeaders, activeOrgId } = await getTeamAdminContext();

    const invitationRecord = await db.query.invitation.findFirst({
        where: and(
            eq(invitation.id, invitationId),
            eq(invitation.organizationId, activeOrgId)
        ),
        columns: {
            id: true,
            status: true,
        },
    });

    if (!invitationRecord || invitationRecord.status !== "pending") {
        throw new Error("Invitation not found");
    }

    await auth.api.cancelInvitation({
        headers: requestHeaders,
        body: {
            invitationId,
        },
    });

    revalidatePath("/settings");
    revalidatePath("/settings/team");
    return { success: true };
}

export async function acceptBusinessInvitation(invitationId: string) {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({
        headers: requestHeaders,
    });

    if (!session) {
        throw new Error("Please sign in to accept this invitation.");
    }

    await auth.api.acceptInvitation({
        headers: requestHeaders,
        body: {
            invitationId,
        },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/onboarding");
    revalidatePath("/settings");
    return { success: true };
}
