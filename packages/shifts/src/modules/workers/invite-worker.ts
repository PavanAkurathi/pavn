import { db } from "@repo/database";
import { invitation, user, member } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export const inviteWorker = async (data: any, orgId: string, inviterId?: string) => {
    const { email, role } = data; // inviterId needs to be passed or extracted from context in route

    // 1. Check if user is already a member
    const existingUser = await db.query.user.findFirst({
        where: eq(user.email, email)
    });

    if (existingUser) {
        const existingMember = await db.query.member.findFirst({
            where: and(
                eq(member.userId, existingUser.id),
                eq(member.organizationId, orgId)
            )
        });

        if (existingMember) {
            throw new Error("User is already a member of this organization");
        }
    }

    // 2. Check for existing pending invitation
    const existingInvite = await db.query.invitation.findFirst({
        where: and(
            eq(invitation.email, email),
            eq(invitation.organizationId, orgId),
            eq(invitation.status, "pending")
        )
    });

    if (existingInvite) {
        throw new Error("Invitation already sent");
    }

    // 3. Create Invitation
    if (!inviterId) {
        throw new Error("Inviter ID required");
    }

    const newInvite = await db.insert(invitation).values({
        id: nanoid(),
        organizationId: orgId,
        email,
        role: role || "member",
        status: "pending",
        inviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }).returning();

    // TODO: Send invitation email via @repo/email or notification service

    return newInvite[0];
};
