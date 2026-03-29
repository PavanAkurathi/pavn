"use server";

import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { createOrganizationCheckoutSession, isBillingConfigured } from "@repo/billing";
import { requireServerEnv } from "@/lib/server-env";
import { db } from "@repo/database";
import { organization } from "@repo/database/schema";
import { eq } from "@repo/database";
import { resolveActiveOrganizationId } from "@/lib/active-organization";

async function getSession() {
    return await auth.api.getSession({ headers: await headers() });
}

export async function createCheckoutSession() {
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

    const orgId = activeOrganizationId;
    const org = await db.query.organization.findFirst({
        where: eq(organization.id, orgId)
    });

    if (!org) return { error: "Organization not found" };

    return createOrganizationCheckoutSession({
        orgId,
        orgName: org.name,
        customerEmail: session!.user.email,
        appUrl: requireServerEnv("NEXT_PUBLIC_APP_URL"),
        priceId: requireServerEnv("STRIPE_PRICE_ID_MONTHLY"),
    });
}
