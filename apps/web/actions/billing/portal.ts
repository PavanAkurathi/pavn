"use server";

import { headers } from "next/headers";
import { db } from "@repo/database";
import { organization } from "@repo/database/schema";
import { eq } from "@repo/database";
import { auth } from "@repo/auth";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeSecretKey || "sk_test_placeholder", {
    apiVersion: "2025-01-27.acacia" as any,
});

async function getSession() {
    return await auth.api.getSession({ headers: await headers() });
}

export async function createCustomerPortal() {
    const session = await getSession();
    const activeOrganizationId = (session?.session as any)?.activeOrganizationId as string | undefined;

    if (!activeOrganizationId) return { error: "Unauthorized - No Active Organization" };

    const org = await db.query.organization.findFirst({
        where: eq(organization.id, activeOrganizationId),
        columns: { stripeCustomerId: true }
    });

    if (!org?.stripeCustomerId) return { error: "No billing account found" };

    const portalSession = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    });

    return { url: portalSession.url };
}
