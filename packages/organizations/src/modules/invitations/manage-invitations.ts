import { auth, sendSMS } from "@repo/auth";
import { sendInvite } from "@repo/email";
import { and, db, eq } from "@repo/database";
import { invitation, member, user } from "@repo/database/schema";
import { TeamMemberInvitationInputSchema } from "@repo/contracts";
import {
    buildBusinessInviteUrl,
    getBusinessInvitationState,
} from "./business-invitations";

export async function createTeamInvitation(
    sourceHeaders: Headers,
    organizationId: string,
    payload: unknown,
) {
    const parsed = TeamMemberInvitationInputSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || "Invalid invitation payload");
    }

    const input = parsed.data;
    const normalizedEmail = input.email.trim().toLowerCase();

    const existingUser = await db.query.user.findFirst({
        where: eq(user.email, normalizedEmail),
        columns: {
            id: true,
        },
    });

    if (existingUser) {
        const existingMember = await db.query.member.findFirst({
            where: and(
                eq(member.userId, existingUser.id),
                eq(member.organizationId, organizationId),
            ),
            columns: {
                id: true,
            },
        });

        if (existingMember) {
            throw new Error("User is already a member of this organization");
        }
    }

    const existingPendingInvitation = await db.query.invitation.findFirst({
        where: and(
            eq(invitation.email, normalizedEmail),
            eq(invitation.organizationId, organizationId),
            eq(invitation.status, "pending"),
        ),
        columns: {
            id: true,
            role: true,
        },
    });

    if (existingPendingInvitation && existingPendingInvitation.role !== input.role) {
        await auth.api.cancelInvitation({
            headers: sourceHeaders,
            body: {
                invitationId: existingPendingInvitation.id,
            },
        });
    }

    const invitationRecord = (await auth.api.createInvitation({
        headers: sourceHeaders,
        body: {
            organizationId,
            email: normalizedEmail,
            role: input.role,
            resend: Boolean(
                existingPendingInvitation &&
                    existingPendingInvitation.role === input.role,
            ),
        },
    })) as { id?: string; invitation?: { id?: string } };

    const invitationId = invitationRecord.id || invitationRecord.invitation?.id;
    if (!invitationId) {
        throw new Error("Failed to create the team invitation");
    }

    const invitationState = await getBusinessInvitationState(invitationId);
    if (!invitationState) {
        throw new Error("Failed to load the pending invitation");
    }

    const inviteUrl = buildBusinessInviteUrl(invitationId, Boolean(existingUser));

    if (input.invites.email) {
        await sendInvite({
            email: normalizedEmail,
            role: input.role,
            inviteUrl,
            organizationName: invitationState.organizationName,
            actionLabel: existingUser
                ? "Review your invitation"
                : "Activate your account",
        });
    }

    if (input.invites.sms && input.phoneNumber) {
        try {
            const message = existingUser
                ? `You've been invited to join ${invitationState.organizationName} on Workers Hive. Review your invitation here: ${inviteUrl}`
                : `You've been invited to join ${invitationState.organizationName} on Workers Hive. Activate your account here: ${inviteUrl}`;
            await sendSMS(input.phoneNumber, message);
        } catch (error) {
            console.error(
                `[TeamInvite] Failed to send SMS invite to ${input.phoneNumber}:`,
                error,
            );
        }
    }

    return { success: true, invitationId };
}

export async function resendTeamInvitation(
    sourceHeaders: Headers,
    organizationId: string,
    invitationId: string,
) {
    const invitationState = await getBusinessInvitationState(invitationId);
    if (!invitationState || invitationState.organizationId !== organizationId) {
        throw new Error("Invitation not found");
    }

    const invitationRecord = (await auth.api.createInvitation({
        headers: sourceHeaders,
        body: {
            organizationId,
            email: invitationState.email,
            role: invitationState.role,
            resend: true,
        },
    })) as { id?: string; invitation?: { id?: string } };

    const effectiveInvitationId =
        invitationRecord.id || invitationRecord.invitation?.id || invitationId;

    const existingUser = await db.query.user.findFirst({
        where: eq(user.email, invitationState.email),
        columns: {
            id: true,
            phoneNumber: true,
        },
    });

    const inviteUrl = buildBusinessInviteUrl(
        effectiveInvitationId,
        Boolean(existingUser),
    );

    await sendInvite({
        email: invitationState.email,
        role: invitationState.role,
        inviteUrl,
        organizationName: invitationState.organizationName,
        actionLabel: existingUser
            ? "Review your invitation"
            : "Activate your account",
    });

    if (existingUser?.phoneNumber) {
        try {
            await sendSMS(
                existingUser.phoneNumber,
                `Reminder: your ${invitationState.organizationName} invitation is ready on Workers Hive. Open: ${inviteUrl}`,
            );
        } catch (error) {
            console.error("[TeamInvite] Failed to resend SMS reminder:", error);
        }
    }

    return { success: true };
}

export async function cancelTeamInvitation(
    sourceHeaders: Headers,
    organizationId: string,
    invitationId: string,
) {
    const invitationRecord = await db.query.invitation.findFirst({
        where: and(
            eq(invitation.id, invitationId),
            eq(invitation.organizationId, organizationId),
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
        headers: sourceHeaders,
        body: {
            invitationId,
        },
    });

    return { success: true };
}

export async function acceptBusinessInvitation(
    sourceHeaders: Headers,
    invitationId: string,
) {
    await auth.api.acceptInvitation({
        headers: sourceHeaders,
        body: {
            invitationId,
        },
    });

    return { success: true };
}
