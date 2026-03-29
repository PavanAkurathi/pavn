import { db } from "@repo/database";
import { eq } from "@repo/database";
import { organization } from "@repo/database/schema";
import type Stripe from "stripe";
import { getStripe, isBillingConfigured, requireStripe } from "./stripe";

export type OrganizationSubscription = {
    status: string;
    currentPeriodEnd?: Date;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
};

export async function getOrganizationSubscription(orgId: string): Promise<OrganizationSubscription> {
    const org = await db.query.organization.findFirst({
        where: eq(organization.id, orgId),
        columns: {
            subscriptionStatus: true,
            currentPeriodEnd: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
        },
    });

    if (!org) {
        return { status: "inactive" };
    }

    return {
        status: org.subscriptionStatus ?? "inactive",
        currentPeriodEnd: org.currentPeriodEnd ?? undefined,
        stripeCustomerId: org.stripeCustomerId ?? null,
        stripeSubscriptionId: org.stripeSubscriptionId ?? null,
    };
}

export async function listOrganizationInvoices(orgId: string) {
    if (!isBillingConfigured()) {
        return [];
    }

    const subscription = await getOrganizationSubscription(orgId);
    if (!subscription.stripeCustomerId) {
        return [];
    }

    const stripe = getStripe();
    if (!stripe) {
        return [];
    }

    const invoices = await stripe.invoices.list({
        customer: subscription.stripeCustomerId,
        limit: 6,
        status: "paid",
    });

    return invoices.data.map((invoice) => ({
        id: invoice.id,
        date: new Date(invoice.created * 1000).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        }),
        amount: new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: invoice.currency,
        }).format(invoice.amount_paid / 100),
        status: invoice.status as "paid" | "open" | "void" | "uncollectible",
        invoiceUrl: invoice.hosted_invoice_url || invoice.invoice_pdf || null,
        description: "Workers Hive Pro",
    }));
}

export async function createOrganizationCheckoutSession(input: {
    orgId: string;
    orgName: string;
    customerEmail?: string | null;
    appUrl: string;
    priceId: string;
}) {
    if (!isBillingConfigured()) {
        return { error: "Billing is not enabled" } as const;
    }

    const stripe = getStripe();
    if (!stripe) {
        return { error: "Billing is not enabled" } as const;
    }

    const subscription = await getOrganizationSubscription(input.orgId);
    let customerId = subscription.stripeCustomerId ?? null;

    if (!customerId) {
        const customer = await stripe.customers.create({
            email: input.customerEmail ?? undefined,
            name: input.orgName,
            metadata: { orgId: input.orgId },
        });
        customerId = customer.id;

        await db.update(organization)
            .set({ stripeCustomerId: customerId })
            .where(eq(organization.id, input.orgId));
    }

    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: input.priceId, quantity: 1 }],
        success_url: `${input.appUrl}/settings/billing?success=true`,
        cancel_url: `${input.appUrl}/settings/billing?canceled=true`,
        metadata: { orgId: input.orgId },
    });

    if (!session.url) {
        return { error: "Failed to create session" } as const;
    }

    return { url: session.url } as const;
}

export async function createOrganizationBillingPortalSession(input: {
    orgId: string;
    returnUrl: string;
}) {
    if (!isBillingConfigured()) {
        return { error: "Billing is not enabled" } as const;
    }

    const subscription = await getOrganizationSubscription(input.orgId);
    if (!subscription.stripeCustomerId) {
        return { error: "No billing account found" } as const;
    }

    const stripe = getStripe();
    if (!stripe) {
        return { error: "Billing is not enabled" } as const;
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: input.returnUrl,
    });

    return { url: session.url } as const;
}

function toPeriodEndDate(unixSeconds?: number | null) {
    if (!unixSeconds) {
        return null;
    }

    return new Date(unixSeconds * 1000);
}

export async function syncOrganizationSubscriptionFromCheckoutCompletion(input: {
    orgId: string;
    customerId: string | null;
    subscriptionId: string;
}) {
    const stripe = requireStripe();
    const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);

    await db.update(organization)
        .set({
            stripeCustomerId: input.customerId,
            stripeSubscriptionId: input.subscriptionId,
            subscriptionStatus: subscription.status,
            currentPeriodEnd: toPeriodEndDate((subscription as any).current_period_end),
        })
        .where(eq(organization.id, input.orgId));
}

export async function syncOrganizationSubscriptionByCustomerId(sub: Stripe.Subscription) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const org = await db.query.organization.findFirst({
        where: eq(organization.stripeCustomerId, customerId),
    });

    if (!org) {
        return null;
    }

    await db.update(organization)
        .set({
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            subscriptionStatus: sub.status,
            currentPeriodEnd: toPeriodEndDate((sub as any).current_period_end),
        })
        .where(eq(organization.id, org.id));

    return org.id;
}

export async function clearOrganizationSubscriptionByCustomerId(sub: Stripe.Subscription) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const org = await db.query.organization.findFirst({
        where: eq(organization.stripeCustomerId, customerId),
    });

    if (!org) {
        return null;
    }

    await db.update(organization)
        .set({
            stripeCustomerId: customerId,
            subscriptionStatus: sub.status,
            currentPeriodEnd: null,
            stripeSubscriptionId: null,
        })
        .where(eq(organization.id, org.id));

    return org.id;
}
