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

export async function getInvoiceHistory() {
    const session = await getSession();
    const activeOrganizationId = (session?.session as any)?.activeOrganizationId as string | undefined;

    if (!activeOrganizationId) return [];

    const org = await db.query.organization.findFirst({
        where: eq(organization.id, activeOrganizationId),
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
