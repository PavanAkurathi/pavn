"use server";

import { auth, sendSMS } from "@repo/auth";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { member, user, invitation, rosterEntry } from "@repo/database/schema";
import { eq, and } from "@repo/database";
import { revalidatePath } from "next/cache";
import { Dub } from "dub";
import { nanoid } from "nanoid";

import { z } from "zod";

interface InviteWorkerInput {
    name: string;
    email: string;
    phoneNumber?: string;
    role: "admin" | "member";
    jobTitle?: string;
    hourlyRate?: number;
    invites: {
        email: boolean;
        sms: boolean;
    };
}

const inviteWorkerSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phoneNumber: z.string().optional(),
    role: z.enum(["admin", "member"]),
    jobTitle: z.string().optional(),
    hourlyRate: z.number().optional(),
    invites: z.object({
        email: z.boolean(),
        sms: z.boolean(),
    }),
});

export async function inviteWorker(rawInput: InviteWorkerInput) {
    try {
        const parsed = inviteWorkerSchema.safeParse(rawInput);
        if (!parsed.success) {
            return { error: "Invalid input data: " + parsed.error.message };
        }
        const input = parsed.data;

        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            throw new Error("Unauthorized");
        }

        // Standard Better-auth v1.2.0 compatibility
        let activeOrgId = (session.session as any).activeOrganizationId as string || undefined;

        if (!activeOrgId) {
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

        if (!currentMember[0] || (currentMember[0].role !== "admin" && currentMember[0].role !== "owner")) {
            throw new Error("Permission denied");
        }

        const { name, email, phoneNumber, role, jobTitle, hourlyRate, invites } = input;

        // 1. Create a true, trackable invitation in BetterAuth
        // NOTE: Even if they already exist, we send an invite. If they exist and are already a member, wait, let's catch that.
        const existingUser = await db.select().from(user).where(eq(user.email, email)).limit(1);
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

        // Use the auth API to create the invitation.
        let invitationRes: any = null;
        let invitationId = "";

        try {
            invitationRes = await auth.api.createInvitation({
                headers: await headers(),
                body: {
                    organizationId: activeOrgId,
                    email: email,
                    role: role,
                }
            });
            // Due to the nature of server actions + betterAuth APIs we might get the object directly or { invitation } based on version
            invitationId = invitationRes?.id || invitationRes?.invitation?.id;

        } catch (inviteErr: any) {
            // If they are already invited, we can just grab the existing invitation ID and proceed to generate the Dub link.
            if (inviteErr.message?.includes("already invited")) {
                console.log(`[WorkerInvite] User ${email} already has a pending invite. Fetching it...`);
                const existingInvite = await db.select().from(invitation).where(
                    and(
                        eq(invitation.email, email),
                        eq(invitation.organizationId, activeOrgId)
                    )
                ).limit(1);

                if (existingInvite[0]) {
                    invitationId = existingInvite[0].id;
                } else {
                    throw new Error("User is allegedly invited but no record found.");
                }
            } else {
                throw inviteErr; // Throw other unexpected BetterAuth errors
            }
        }

        if (!invitationId) {
            // Fallback if the direct API call fails/doesn't return ID - shouldn't happen usually
            throw new Error("Failed to generate or fetch BetterAuth Invitation ID");
        }

        // --- NEW: Create or update a roster_entry so the Name and details show up ---
        const existingRoster = await db.select().from(rosterEntry).where(
            and(
                eq(rosterEntry.email, email),
                eq(rosterEntry.organizationId, activeOrgId)
            )
        ).limit(1);

        if (existingRoster[0]) {
            // Update existing entry with newer details from manual invite
            await db.update(rosterEntry).set({
                name,
                phoneNumber: phoneNumber || existingRoster[0].phoneNumber,
                jobTitle: jobTitle || existingRoster[0].jobTitle,
                hourlyRate: hourlyRate !== undefined ? hourlyRate : existingRoster[0].hourlyRate,
                status: "invited",
                role: role
            }).where(eq(rosterEntry.id, existingRoster[0].id));
        } else {
            // Create a new entry
            await db.insert(rosterEntry).values({
                id: nanoid(),
                organizationId: activeOrgId,
                name,
                email,
                phoneNumber: phoneNumber || null,
                jobTitle: jobTitle || null,
                hourlyRate: hourlyRate !== undefined ? hourlyRate : null,
                status: "invited",
                role: role,
                createdAt: new Date()
            });
        }
        // --------------------------------------------------------------------------

        let shortLink = "";

        // Initialize Dub SDK exactly when needed to ensure process.env is read at runtime
        const dubToken = process.env.DUB_API_KEY;
        const dub = new Dub({
            token: dubToken || "dub_test_token"
        });

        // 2. Generate Dub.co Trackable & Deferred Deep Link
        if (invites.sms && phoneNumber) {
            try {
                // The URL is the fallback web URL. We append orgToken so if they use desktop it still works.
                const originalUrl = `https://pavn.link/invite?orgToken=${invitationId}`;

                // Only attempt real Dub.co tracking link if a key exists and we are not in simple test mode
                if (dubToken && dubToken !== "dub_test_token") {
                    const linkObj = await dub.links.create({
                        url: originalUrl,
                        domain: process.env.NEXT_PUBLIC_DUB_DOMAIN || "links.workershive.com"
                    });
                    shortLink = linkObj.shortLink;
                } else {
                    console.log("[WorkerInvite] Missing real DUB_API_KEY, falling back to original URL");
                    shortLink = originalUrl;
                }

                // 3. Send SMS via Twilio using the Dub link (or fallback link)
                const message = `You've been invited to join the team on WorkersHive! Click here to download the app and join: ${shortLink}`;
                await sendSMS(phoneNumber, message);
                console.log(`[WorkerInvite] Sent SMS to ${phoneNumber}: ${shortLink}`);

            } catch (err: any) {
                console.error("[WorkerInvite] Dub.co Link Generation or SMS Error:", err);

                // If it's specifically a Dub API error but Twilio might be fine, or Twilio failed.
                // In dev, we don't want to completely block the user from proceeding.
                if (process.env.NODE_ENV === "development") {
                    console.log("[WorkerInvite] Suppressing SMS/Dub error in development environment.");
                } else {
                    return { error: `Failed to create short link or send SMS: ${err.message}` };
                }
            }
        }

        // Return the link in development if you're testing on the same device and it failed to generate
        if (process.env.NODE_ENV === "development" && !shortLink) {
            shortLink = `https://${process.env.NEXT_PUBLIC_DUB_DOMAIN || "links.workershive.com"}/fake-dev-link?orgToken=${invitationId}`;
        }

        revalidatePath("/rosters");
        revalidatePath("/settings/team");

        return { success: true, link: shortLink };
    } catch (e: any) {
        console.error("SERVER ACTION ERROR:", e);
        return { error: e.message || "Failed to invite worker" };
    }
}
