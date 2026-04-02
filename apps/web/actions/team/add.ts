"use server";

import { auth, sendSMS } from "@repo/auth";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { member, user, invitation } from "@repo/database/schema";
import { eq, and } from "@repo/database";
import { revalidatePath } from "next/cache";
import { sendInvite } from "@repo/email";
import {
    buildBusinessInviteUrl,
    getBusinessInvitationState,
} from "@/lib/server/business-invitations";
import { isAdminOrganizationRole } from "@/lib/server/organization-roles";

import { z } from "zod";

interface AddMemberInput {
    name: string;
    email: string;
    phoneNumber?: string;
    role: "admin" | "manager";
    jobTitle?: string;
    // Profile Extensions
    image?: string;
    emergencyContact?: {
        name: string;
        phone: string;
        relation: string;
    };
    address?: {
        street: string;
        city: string;
        state: string;
        zip: string;
    };
    certifications?: {
        name: string;
        issuer: string;
        expiresAt: Date;
    }[];
    invites: {
        email: boolean;
        sms: boolean;
    };
}

const addMemberSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phoneNumber: z.string().optional(),
    role: z.enum(["admin", "manager"]),
    jobTitle: z.string().optional(),
    image: z.string().optional(),
    emergencyContact: z.object({
        name: z.string(),
        phone: z.string(),
        relation: z.string(),
    }).optional(),
    address: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
    }).optional(),
    certifications: z.array(z.object({
        name: z.string(),
        issuer: z.string(),
        expiresAt: z.coerce.date(),
    })).optional(),
    invites: z.object({
        email: z.boolean(),
        sms: z.boolean(),
    }),
});

export async function addMember(rawInput: AddMemberInput) {
    try {
        const parsed = addMemberSchema.safeParse(rawInput);
        if (!parsed.success) {
            return { error: "Invalid input data: " + parsed.error.message };
        }
        const input = parsed.data;

        const requestHeaders = await headers();
        const session = await auth.api.getSession({
            headers: requestHeaders
        });

        if (!session) {
            throw new Error("Unauthorized");
        }

        // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
        let activeOrgId = (session.session as any).activeOrganizationId as string || undefined;

        if (!activeOrgId) {
            // Fallback: Check DB for membership (First org found)
            const defaultOrg = await db.select().from(member).where(eq(member.userId, session.user.id)).limit(1);
            if (defaultOrg[0]) {
                activeOrgId = defaultOrg[0].organizationId;
            }
        }

        if (!activeOrgId) {
            throw new Error("No active organization");
        }

        // Verify permission (must be admin/owner of the org)
        const currentMember = await db.select()
            .from(member)
            .where(and(
                eq(member.userId, session.user.id),
                eq(member.organizationId, activeOrgId)
            ))
            .limit(1);

        if (!currentMember[0] || !isAdminOrganizationRole(currentMember[0].role)) {
            throw new Error("Permission denied");
        }

        const { email, phoneNumber, role, invites } = input;
        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await db.select().from(user).where(eq(user.email, normalizedEmail)).limit(1);

        if (existingUser[0]) {
            const existingMember = await db.select()
                .from(member)
                .where(and(
                    eq(member.userId, existingUser[0].id),
                    eq(member.organizationId, activeOrgId)
                ))
                .limit(1);

            if (existingMember[0]) {
                return { error: "User is already a member of this organization" };
            }

        }

        const existingPendingInvitation = await db.query.invitation.findFirst({
            where: and(
                eq(invitation.email, normalizedEmail),
                eq(invitation.organizationId, activeOrgId),
                eq(invitation.status, "pending")
            ),
            columns: {
                id: true,
                role: true,
            },
        });

        if (existingPendingInvitation && existingPendingInvitation.role !== role) {
            await auth.api.cancelInvitation({
                headers: requestHeaders,
                body: {
                    invitationId: existingPendingInvitation.id,
                },
            });
        }

        const invitationRecord = await auth.api.createInvitation({
            headers: requestHeaders,
            body: {
                organizationId: activeOrgId,
                email: normalizedEmail,
                role,
                resend: Boolean(existingPendingInvitation && existingPendingInvitation.role === role),
            },
        }) as { id?: string; invitation?: { id?: string } };

        const invitationId = invitationRecord.id || invitationRecord.invitation?.id;
        if (!invitationId) {
            throw new Error("Failed to create the team invitation");
        }

        const invitationState = await getBusinessInvitationState(invitationId);
        if (!invitationState) {
            throw new Error("Failed to load the pending invitation");
        }

        const inviteUrl = buildBusinessInviteUrl(invitationId, Boolean(existingUser[0]));

        if (invites.email) {
            await sendInvite({
                email: normalizedEmail,
                role,
                inviteUrl,
                organizationName: invitationState.organizationName,
                actionLabel: existingUser[0] ? "Review your invitation" : "Activate your account",
            });
            console.log(`[Email] Dispatched team invite to ${normalizedEmail} for role ${role}`);
        }

        if (invites.sms && phoneNumber) {
            try {
                const message = existingUser[0]
                    ? `You've been invited to join ${invitationState.organizationName} on Workers Hive. Review your invitation here: ${inviteUrl}`
                    : `You've been invited to join ${invitationState.organizationName} on Workers Hive. Activate your account here: ${inviteUrl}`;
                await sendSMS(phoneNumber, message);
                console.log(`[Team] Sent SMS invite to ${phoneNumber}`);
            } catch (error) {
                console.error(`[Team] Failed to send SMS invite to ${phoneNumber}:`, error);
                // We don't throw here to avoid failing the whole member addition just because SMS failed
            }
        }

        revalidatePath("/settings");
        revalidatePath("/settings/team");
        return { success: true, invitationId };
    } catch (e: any) {
        console.error("SERVER ACTION ERROR:", e);
        return { error: e.message || "Failed to add member" };
    }
}
