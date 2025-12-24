// apps/web/actions/billing.ts

"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { organization } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { auth } from "@repo/auth";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover" as any, // Always use latest or your pinned version
});

async function getSession() {
    return await auth.api.getSession({ headers: await headers() });
}

// ---------------------------------------------------------
// 1. BUY (Redirect to Stripe Checkout)
// ---------------------------------------------------------
export async function createCheckoutSession() {
    const session = await getSession();
    if (!session?.session.activeOrganizationId) return { error: "Unauthorized" };

    const orgId = session.session.activeOrganizationId;
    const org = await db.query.organization.findFirst({
        where: eq(organization.id, orgId)
    });

    if (!org) return { error: "Organization not found" };

    // Reuse existing Stripe Customer ID if we have it
    let customerId = org.stripeCustomerId;

    if (!customerId) {
        const customer = await stripe.customers.create({
            email: session.user.email,
            name: org.name,
            metadata: { orgId: orgId } // CRITICAL: Links Stripe back to DB
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

// ---------------------------------------------------------
// 2. MANAGE (Redirect to Stripe Portal)
// ---------------------------------------------------------
export async function createCustomerPortal() {
    const session = await getSession();
    if (!session?.session.activeOrganizationId) return { error: "Unauthorized" };

    const org = await db.query.organization.findFirst({
        where: eq(organization.id, session.session.activeOrganizationId),
        columns: { stripeCustomerId: true }
    });

    if (!org?.stripeCustomerId) return { error: "No billing account found" };

    const portalSession = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    });

    return { url: portalSession.url };
}

// ---------------------------------------------------------
// 3. GET RECEIPTS (Fetch Invoice History)
// ---------------------------------------------------------
export async function getInvoiceHistory() {
    const session = await getSession();
    if (!session?.session.activeOrganizationId) return [];

    const org = await db.query.organization.findFirst({
        where: eq(organization.id, session.session.activeOrganizationId),
        columns: { stripeCustomerId: true }
    });

    if (!org?.stripeCustomerId) return [];

    try {
        const invoices = await stripe.invoices.list({
            customer: org.stripeCustomerId,
            limit: 6,
            status: "paid", // Only show paid receipts
        });

        return invoices.data.map((inv) => ({
            id: inv.id,
            date: new Date(inv.created * 1000).toLocaleDateString("en-US", {
                year: "numeric", month: "short", day: "numeric"
            }),
            amount: new Intl.NumberFormat("en-US", {
                style: "currency", currency: inv.currency
            }).format(inv.amount_paid / 100),
            status: inv.status as "paid" | "open" | "void" | "uncollectible",
            invoiceUrl: inv.hosted_invoice_url || inv.invoice_pdf,
            description: `Workers Hive Pro`
        }));
    } catch (e) {
        console.error("Stripe Fetch Error", e);
        return [];
    }

}

// ---------------------------------------------------------
// 4. GET SUBSCRIPTION DETAILS
// ---------------------------------------------------------
export async function getSubscriptionDetails() {
    const session = await getSession();
    if (!session?.session.activeOrganizationId) return { status: "inactive" };

    const org = await db.query.organization.findFirst({
        where: eq(organization.id, session.session.activeOrganizationId),
        columns: { stripeCustomerId: true, stripeSubscriptionId: true }
    });

    if (!org?.stripeCustomerId) return { status: "inactive" };

    try {
        // If we have a sub ID, fetch it
        if (org.stripeSubscriptionId) {
            const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
            return {
                status: sub.status,
                currentPeriodEnd: (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000) : undefined
            };
        }

        // Fallback: list subs
        const subs = await stripe.subscriptions.list({
            customer: org.stripeCustomerId,
            limit: 1,
            status: "active"
        });

        const sub = subs.data[0];
        if (sub) {
            return {
                status: sub.status,
                currentPeriodEnd: (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000) : undefined
            };
        }

        return { status: "inactive" };
    } catch (e) {
        console.error("Stripe Sub Fetch Error", e);
        return { status: "inactive" };
    }
}