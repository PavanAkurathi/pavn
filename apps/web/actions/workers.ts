"use server";

import { auth, sendSMS } from "@repo/auth";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { member, user, invitation } from "@repo/database/schema";
import { eq, and } from "@repo/database";
import { revalidatePath } from "next/cache";
import { Dub } from "dub";



interface InviteWorkerInput {
    name: string;
    email: string;
    phoneNumber?: string;
    role: "admin" | "member";
    jobTitle?: string;
    invites: {
        email: boolean;
        sms: boolean;
    };
}

export async function inviteWorker(input: InviteWorkerInput) {
    try {
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

        const { name, email, phoneNumber, role, jobTitle, invites } = input;

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

        let shortLink = "";

        // Initialize Dub SDK exactly when needed to ensure process.env is read at runtime
        const dub = new Dub({
            token: process.env.DUB_API_KEY || "dub_test_token"
        });

        // 2. Generate Dub.co Trackable & Deferred Deep Link
        if (invites.sms && phoneNumber) {
            try {
                // The URL is the fallback web URL. We append orgToken so if they use desktop it still works.
                // The iOS/Android specific App store routing happens within Dub config, but linking is intercepted if App is installed.
                const originalUrl = `https://pavn.link/invite?orgToken=${invitationId}`;

                const linkObj = await dub.links.create({
                    url: originalUrl,
                    domain: process.env.NEXT_PUBLIC_DUB_DOMAIN || "links.workershive.com"
                });

                shortLink = linkObj.shortLink;

                // 3. Send SMS via Twilio using the Dub link
                const message = `You've been invited to join the team on WorkersHive! Click here to download the app and join: ${shortLink}`;
                await sendSMS(phoneNumber, message);
                console.log(`[WorkerInvite] Sent Dub.co SMS to ${phoneNumber}: ${shortLink}`);

            } catch (err: any) {
                console.error("[WorkerInvite] Dub.co Link Generation or SMS Error:", err);
                // Return descriptive error
                return { error: `Failed to create short link or send SMS: ${err.message}` };
            }
        }

        // Return the link in development if you're testing on the same device
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

export async function bulkInviteWorkers(rosterEntryIds: string[]) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) throw new Error("Unauthorized");
        let activeOrgId = (session.session as any).activeOrganizationId as string || undefined;
        if (!activeOrgId) {
            const defaultOrg = await db.select().from(member).where(eq(member.userId, session.user.id)).limit(1);
            if (defaultOrg[0]) activeOrgId = defaultOrg[0].organizationId;
        }
        if (!activeOrgId) throw new Error("No active organization");

        // Verify admin
        const currentMember = await db.select()
            .from(member)
            .where(and(
                eq(member.userId, session.user.id),
                eq(member.organizationId, activeOrgId)
            )).limit(1);

        if (!currentMember[0] || (currentMember[0].role !== "admin" && currentMember[0].role !== "owner")) {
            throw new Error("Permission denied");
        }

        const { inArray } = await import("@repo/database");
        const { rosterEntry } = await import("@repo/database/schema");

        const entries = await db.select().from(rosterEntry).where(
            and(
                inArray(rosterEntry.id, rosterEntryIds),
                eq(rosterEntry.organizationId, activeOrgId)
            )
        );

        let successCount = 0;
        const dub = new Dub({ token: process.env.DUB_API_KEY || "dub_test_token" });

        for (const entry of entries) {
            try {
                const invitationRes = (await auth.api.createInvitation({
                    headers: await headers(),
                    body: {
                        organizationId: activeOrgId,
                        email: entry.email,
                        role: (entry.role as "admin" | "member") || "member",
                    }
                })) as any;

                const invitationId = invitationRes?.id || (invitationRes as any)?.invitation?.id;

                let shortLink = "";
                if (entry.phoneNumber && invitationId) {
                    try {
                        const originalUrl = `https://pavn.link/invite?orgToken=${invitationId}`;
                        const linkObj = await dub.links.create({
                            url: originalUrl,
                            domain: process.env.NEXT_PUBLIC_DUB_DOMAIN || "links.workershive.com"
                        });
                        shortLink = linkObj.shortLink;

                        const message = `You've been invited to join the team on WorkersHive! Download the app and join: ${shortLink}`;
                        await sendSMS(entry.phoneNumber, message);
                        console.log(`[BulkInvite] SMS sent to ${entry.phoneNumber}: ${shortLink}`);
                    } catch (err: any) {
                        console.error("[BulkInvite] Dub.co/SMS Error:", err.message);
                    }
                }

                await db.update(rosterEntry)
                    .set({ status: "invited" })
                    .where(eq(rosterEntry.id, entry.id));

                successCount++;
            } catch (err: any) {
                console.error(`[BulkInvite] Failed to invite ${entry.email}:`, err.message);
            }
        }

        revalidatePath("/rosters");
        revalidatePath("/settings/team");
        return { success: true, count: successCount };

    } catch (e: any) {
        console.error("BULK INVITE ERROR:", e);
        return { error: e.message || "Failed to process bulk invites" };
    }
}

