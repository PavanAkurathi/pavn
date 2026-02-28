"use server";

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { member, user, invitation, rosterEntry } from "@repo/database/schema";
import { eq, and } from "@repo/database";
import { revalidatePath } from "next/cache";

import { z } from "zod";

const removeWorkerSchema = z.string().email();

export async function removeWorker(rawEmail: string) {
    try {
        const parsed = removeWorkerSchema.safeParse(rawEmail);
        if (!parsed.success) {
            return { error: "Invalid email address: " + parsed.error.message };
        }
        const email = parsed.data;

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

        // Verify admin/owner
        const currentMember = await db.select()
            .from(member)
            .where(and(
                eq(member.userId, session.user.id),
                eq(member.organizationId, activeOrgId)
            )).limit(1);

        if (!currentMember[0] || (currentMember[0].role !== "admin" && currentMember[0].role !== "owner")) {
            throw new Error("Permission denied");
        }

        // Delete from member table if they exist as a real user
        const targetUser = await db.select().from(user).where(eq(user.email, email)).limit(1);
        if (targetUser[0]) {
            await db.delete(member).where(and(
                eq(member.userId, targetUser[0].id),
                eq(member.organizationId, activeOrgId)
            ));
        }

        // Delete pending invitation records
        await db.delete(invitation).where(and(
            eq(invitation.email, email),
            eq(invitation.organizationId, activeOrgId)
        ));

        // Delete staging roster records
        await db.delete(rosterEntry).where(and(
            eq(rosterEntry.email, email),
            eq(rosterEntry.organizationId, activeOrgId)
        ));

        revalidatePath("/rosters");
        revalidatePath("/settings/team");

        return { success: true };
    } catch (e: any) {
        console.error("[RemoveWorker] Error:", e);
        return { error: e.message || "Failed to remove worker" };
    }
}
