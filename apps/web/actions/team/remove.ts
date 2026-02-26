"use server";

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { member } from "@repo/database/schema";
import { eq, and } from "@repo/database";
import { revalidatePath } from "next/cache";

export async function removeMember(memberId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    const activeOrgId = (session.session as any).activeOrganizationId as string || undefined;
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

    // Delete the member from the organization
    await db.delete(member)
        .where(and(
            eq(member.id, memberId),
            eq(member.organizationId, activeOrgId)
        ));

    revalidatePath("/rosters");
    revalidatePath("/settings/team");
    return { success: true };
}
