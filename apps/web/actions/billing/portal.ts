"use server";

import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { createOrganizationBillingPortalSession, isBillingConfigured } from "@repo/billing";
import { requireServerEnv } from "@/lib/server-env";
import { resolveActiveOrganizationId } from "@/lib/active-organization";

async function getSession() {
    return await auth.api.getSession({ headers: await headers() });
}

export async function createCustomerPortal() {
    if (!isBillingConfigured()) {
        return { error: "Billing is not enabled" };
    }

    const session = await getSession();
    const activeOrganizationId = session
        ? await resolveActiveOrganizationId(
            session.user.id,
            (session.session as any)?.activeOrganizationId as string | undefined,
        )
        : null;

    if (!activeOrganizationId) return { error: "Unauthorized - No Active Organization" };

    return createOrganizationBillingPortalSession({
        orgId: activeOrganizationId,
        returnUrl: `${requireServerEnv("NEXT_PUBLIC_APP_URL")}/settings/billing`,
    });
}
