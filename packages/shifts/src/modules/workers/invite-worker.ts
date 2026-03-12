import { db, resolveWorkerRoleSet } from "@repo/database";
import { invitation, user, member, rosterEntry } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { normalizePhoneNumber } from "@repo/auth/providers/sms";
import { z } from "zod";

const InviteWorkerInputSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email(),
    phoneNumber: z.string().optional(),
    role: z.enum(["admin", "member"]).optional(),
    jobTitle: z.string().optional(),
    roles: z.array(z.string().min(1)).optional(),
    hourlyRate: z.number().int().nonnegative().optional(),
});

export const inviteWorker = async (data: unknown, orgId: string, inviterId?: string) => {
    const parsed = InviteWorkerInputSchema.safeParse(data);
    if (!parsed.success) {
        throw new Error(`Invalid worker invite payload: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
    }

    const { name, email, phoneNumber, role, jobTitle, roles, hourlyRate } = parsed.data;
    const resolvedRoles = resolveWorkerRoleSet({
        roles,
        fallbackRole: jobTitle,
    });
    const primaryRole = resolvedRoles[0] ?? jobTitle ?? null;
    const normalizedPhoneNumber = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;

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

    const existingRoster = await db.query.rosterEntry.findFirst({
        where: and(
            eq(rosterEntry.email, email),
            eq(rosterEntry.organizationId, orgId)
        )
    });

    if (existingRoster) {
        await db.update(rosterEntry)
            .set({
                name: name || existingRoster.name,
                phoneNumber: normalizedPhoneNumber || existingRoster.phoneNumber,
                jobTitle: primaryRole || existingRoster.jobTitle,
                roles: resolvedRoles.length > 0 ? resolvedRoles : (existingRoster.roles || []),
                hourlyRate: hourlyRate !== undefined ? hourlyRate : existingRoster.hourlyRate,
                role: role || existingRoster.role || "member",
                status: "invited",
            })
            .where(eq(rosterEntry.id, existingRoster.id));
    } else {
        await db.insert(rosterEntry).values({
            id: nanoid(),
            organizationId: orgId,
            name: name || email,
            email,
            phoneNumber: normalizedPhoneNumber,
            role: role || "member",
            hourlyRate: hourlyRate ?? null,
            jobTitle: primaryRole,
            roles: resolvedRoles,
            status: "invited",
            createdAt: new Date(),
        });
    }

    // TODO: Send invitation email via @repo/email or notification service

    return newInvite[0];
};
