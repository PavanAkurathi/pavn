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

export async function createCheckoutSession() {
    const session = await getSession();
    const activeOrganizationId = (session?.session as any)?.activeOrganizationId as string | undefined;

    if (!activeOrganizationId) return { error: "Unauthorized - No Active Organization" };

    const orgId = activeOrganizationId;
    const org = await db.query.organization.findFirst({
        where: eq(organization.id, orgId)
    });

    if (!org) return { error: "Organization not found" };

    let customerId = org.stripeCustomerId;

    if (!customerId) {
        const customer = await stripe.customers.create({
            email: session!.user.email,
            name: org.name,
            metadata: { orgId: orgId }
        });
        customerId = customer.id;

        await db.update(organization)
            .set({ stripeCustomerId: customerId })
            .where(eq(organization.id, orgId));
    }

    const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: process.env.STRIPE_PRICE_ID_MONTHLY, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
        metadata: { orgId: orgId },
    });

    if (!checkoutSession.url) return { error: "Failed to create session" };
    return { url: checkoutSession.url };
}
