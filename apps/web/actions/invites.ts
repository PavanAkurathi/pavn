"use server";

import { auth, sendSMS } from "@repo/auth";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { member, user } from "@repo/database/schema";
import { eq, and } from "@repo/database";
import { revalidatePath } from "next/cache";

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

    if (phoneNumber) {
        // Dynamic link logic would go here
        const downloadLink = "exp://pavn.link/invite";
        const message = `REMINDER: You've been invited to join ${activeOrgId?.slice(0, 8)}...'s team on Pavn! Download the app: ${downloadLink}`;

        try {
            await sendSMS(phoneNumber, message);
            return { success: true, method: "SMS" };
        } catch (e) {
            console.error("Failed to resend SMS", e);
            throw new Error("Failed to send SMS");
        }
    }

    // TODO: Add Email Resend logic here if needed

    return { success: true, method: "Email (Mock)" };
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

    if (!currentMember || (currentMember.role !== 'admin' && currentMember.role !== 'owner')) {
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
