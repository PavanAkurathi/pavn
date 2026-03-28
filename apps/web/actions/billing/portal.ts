"use server";

import { headers } from "next/headers";
import { db } from "@repo/database";
import { organization } from "@repo/database/schema";
import { eq } from "@repo/database";
import { auth } from "@repo/auth";
import { requireServerEnv } from "@/lib/server-env";
import { getStripe, isBillingConfigured } from "@/lib/billing/stripe";
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

    const org = await db.query.organization.findFirst({
        where: eq(organization.id, activeOrganizationId),
        columns: { stripeCustomerId: true }
    });

    if (!org?.stripeCustomerId) return { error: "No billing account found" };

    const stripe = getStripe();
    if (!stripe) {
        return { error: "Billing is not enabled" };
    }

    const portalSession = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${requireServerEnv("NEXT_PUBLIC_APP_URL")}/settings/billing`,
    });

    return { url: portalSession.url };
}
