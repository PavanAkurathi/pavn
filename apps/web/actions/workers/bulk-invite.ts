"use server";

import { auth, sendSMS } from "@repo/auth";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { member } from "@repo/database/schema";
import { eq, and } from "@repo/database";
import { revalidatePath } from "next/cache";
import { Dub } from "dub";

import { z } from "zod";

const bulkInviteSchema = z.array(z.string());

export async function bulkInviteWorkers(rawInput: string[]) {
    try {
        const parsed = bulkInviteSchema.safeParse(rawInput);
        if (!parsed.success) {
            return { error: "Invalid input data: " + parsed.error.message };
        }
        const rosterEntryIds = parsed.data;

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
        const dubToken = process.env.DUB_API_KEY;
        const dub = new Dub({ token: dubToken || "dub_test_token" });

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

                        if (dubToken && dubToken !== "dub_test_token") {
                            const linkObj = await dub.links.create({
                                url: originalUrl,
                                domain: process.env.NEXT_PUBLIC_DUB_DOMAIN || "links.workershive.com"
                            });
                            shortLink = linkObj.shortLink;
                        } else {
                            console.log("[BulkInvite] Missing real DUB_API_KEY, falling back to original URL");
                            shortLink = originalUrl;
                        }

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
