"use server";

import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { getOrganizationSubscription } from "@repo/billing";
import { resolveActiveOrganizationId } from "@/lib/active-organization";

async function getSession() {
    return await auth.api.getSession({ headers: await headers() });
}

export async function getSubscriptionDetails() {
    const session = await getSession();
    const activeOrganizationId = session
        ? await resolveActiveOrganizationId(
            session.user.id,
            (session.session as any)?.activeOrganizationId as string | undefined,
        )
        : null;

    if (!activeOrganizationId) return { status: "inactive" };

    return getOrganizationSubscription(activeOrganizationId);
}
