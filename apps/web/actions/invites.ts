"use server";

import { auth, sendSMS } from "@repo/auth";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { member } from "@repo/database/schema";
import { eq, and } from "@repo/database";
import { revalidatePath } from "next/cache";
import { sendInvite } from "@repo/email";

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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const methods: string[] = [];

    if (email && process.env.RESEND_API_KEY) {
        await sendInvite(email, memberRecord.role, appUrl);
        methods.push("email");
    }

    if (phoneNumber) {
        const loginUrl = `${appUrl}/auth/login`;
        const message = `REMINDER: You've been invited to join your team on Workers Hive. Sign in here: ${loginUrl}`;

        try {
            await sendSMS(phoneNumber, message);
            methods.push("sms");
        } catch (e) {
            console.error("Failed to resend SMS", e);
            if (methods.length === 0) {
                throw new Error("Failed to send invite");
            }
        }
    }

    if (methods.length === 0) {
        throw new Error("No invite delivery method is configured for this member");
    }

    return { success: true, method: methods.join("+") };
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
