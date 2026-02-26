"use server";

import { headers } from "next/headers";
import { db } from "@repo/database";
import { organization } from "@repo/database/schema";
import { eq } from "@repo/database";
import { auth } from "@repo/auth";

async function getSession() {
    return await auth.api.getSession({ headers: await headers() });
}

export async function getSubscriptionDetails() {
    const session = await getSession();
    const activeOrganizationId = (session?.session as any)?.activeOrganizationId as string | undefined;

    if (!activeOrganizationId) return { status: "inactive" };

    const org = await db.query.organization.findFirst({
        where: eq(organization.id, activeOrganizationId),
        columns: {
            subscriptionStatus: true,
            currentPeriodEnd: true
        }
    });

    if (!org) return { status: "inactive" };

    return {
        status: org.subscriptionStatus ?? "inactive",
        currentPeriodEnd: org.currentPeriodEnd ?? undefined
    };
}
