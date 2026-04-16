import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
    BillingRedirectSessionSchema,
    BillingInfoSchema,
    InvoiceHistorySchema,
    StripeWebhookAcknowledgementSchema,
} from "@repo/contracts/billing";
import type { AppContext } from "../index";
import { isAdminRole } from "../lib/organization-roles.js";
import { logError, logMessage } from "@repo/observability";
import {
    clearOrganizationSubscriptionByCustomerId,
    createOrganizationBillingPortalSession,
    createOrganizationCheckoutSession,
    getOrganizationSubscription,
    listOrganizationInvoices,
    requireStripe,
    syncOrganizationSubscriptionByCustomerId,
    syncOrganizationSubscriptionFromCheckoutCompletion,
} from "@repo/billing";
import { getOrganizationSummary } from "@repo/organizations";
import type Stripe from "stripe";

export const billingRouter = new OpenAPIHono<AppContext>();

const BillingMutationUnavailableSchema = z.object({
    error: z.string(),
    message: z.string(),
});

const billingMutationUnavailable = (c: any) =>
    c.json({
        error: "Billing mutations are handled in the web app",
        message: "Use the web checkout or customer portal for payment method and subscription changes.",
    } as const, 501);

// =============================================================================
// SUBSCRIPTION / BILLING INFO (Manager can view)
// =============================================================================

const getBillingRoute = createRoute({
    method: 'get',
    path: '/',
    summary: 'Get Billing Overview',
    description: 'Get current organization subscription status.',
    responses: {
        200: { content: { 'application/json': { schema: BillingInfoSchema } }, description: 'Billing info' },
        403: { description: 'Forbidden' },
    }
});

billingRouter.openapi(getBillingRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) {
        return c.json({ error: "Access denied" }, 403);
    }

    const orgId = c.get("orgId");
    const billing = await getOrganizationSubscription(orgId);

    return c.json({
        status: billing.status,
        currentPeriodEnd: billing.currentPeriodEnd?.toISOString() ?? null,
        stripeCustomerId: billing.stripeCustomerId ?? null,
        stripeSubscriptionId: billing.stripeSubscriptionId ?? null,
    }, 200);
});

const getInvoicesRoute = createRoute({
    method: 'get',
    path: '/invoices',
    summary: 'Get Invoices',
    description: 'Get paid invoice history for the active organization.',
    responses: {
        200: { content: { 'application/json': { schema: InvoiceHistorySchema } }, description: 'Invoices' },
        403: { description: 'Forbidden' },
    }
});

billingRouter.openapi(getInvoicesRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const invoices = await listOrganizationInvoices(orgId);
    return c.json(invoices, 200);
});

const createCheckoutSessionRoute = createRoute({
    method: "post",
    path: "/checkout-session",
    summary: "Create Checkout Session",
    description: "Create a Stripe checkout session for the active organization.",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: BillingRedirectSessionSchema,
                },
            },
            description: "Checkout session",
        },
        403: { description: "Forbidden" },
    },
});

billingRouter.openapi(createCheckoutSessionRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const user = c.get("user");
    const org = await getOrganizationSummary(orgId);

    if (!user || !org) {
        return c.json({ error: "Organization not found" }, 404);
    }

    const result = await createOrganizationCheckoutSession({
        orgId,
        orgName: org.name,
        customerEmail: user.email,
        appUrl:
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.BETTER_AUTH_URL ||
            "http://localhost:3000",
        priceId: process.env.STRIPE_PRICE_ID_MONTHLY || "",
    });

    return c.json(result, 200);
});

const createPortalSessionRoute = createRoute({
    method: "post",
    path: "/portal-session",
    summary: "Create Billing Portal Session",
    description: "Create a Stripe billing portal session for the active organization.",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: BillingRedirectSessionSchema,
                },
            },
            description: "Billing portal session",
        },
        403: { description: "Forbidden" },
    },
});

billingRouter.openapi(createPortalSessionRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await createOrganizationBillingPortalSession({
        orgId,
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000"}/settings/billing`,
    });

    return c.json(result, 200);
});

const stripeWebhookRoute = createRoute({
    method: "post",
    path: "/webhooks/stripe",
    summary: "Handle Stripe Webhooks",
    description: "Handle Stripe billing webhooks for organization subscriptions.",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: StripeWebhookAcknowledgementSchema,
                },
            },
            description: "Webhook acknowledged",
        },
        400: { description: "Webhook error" },
        500: { description: "Handler failure" },
    },
});

billingRouter.openapi(stripeWebhookRoute, async (c) => {
    const body = await c.req.raw.text();
    const signature = c.req.header("stripe-signature");
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    try {
        if (!signature || !endpointSecret) {
            return c.json({ error: "Webhook Error" }, 400);
        }

        const stripe = requireStripe();
        event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (error: any) {
        logMessage("[Billing] Webhook signature verification failed", { error: error.message });
        return c.json({ error: `Webhook Error: ${error.message}` }, 400);
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.subscription) {
                    const subscriptionId =
                        typeof session.subscription === "string"
                            ? session.subscription
                            : session.subscription.id;
                    const orgId = session.metadata?.orgId;
                    const customerId =
                        typeof session.customer === "string"
                            ? session.customer
                            : session.customer?.id ?? null;

                    if (orgId && subscriptionId) {
                        await syncOrganizationSubscriptionFromCheckoutCompletion({
                            orgId,
                            customerId,
                            subscriptionId,
                        });
                    }
                }
                break;
            }

            case "customer.subscription.created":
            case "customer.subscription.updated": {
                const subscription = event.data.object as Stripe.Subscription;
                await syncOrganizationSubscriptionByCustomerId(subscription);
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                await clearOrganizationSubscriptionByCustomerId(subscription);
                break;
            }

            default:
        }
    } catch (error) {
        logError(error, { context: "stripe_webhook_handler", eventType: event.type });
        return c.json({ error: "Webhook handler failed" }, 500);
    }

    return c.json({ received: true }, 200);
});

const getUsageRoute = createRoute({
    method: 'get',
    path: '/usage',
    summary: 'Get Usage Stats',
    description: 'Usage reporting is not exposed through the API.',
    responses: {
        403: { description: 'Forbidden' },
        501: { content: { 'application/json': { schema: BillingMutationUnavailableSchema } }, description: 'Not implemented' }
    }
});

billingRouter.openapi(getUsageRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    return billingMutationUnavailable(c);
});

// =============================================================================
// PAYMENT METHODS (Admin ONLY - Managers cannot CRUD)
// =============================================================================

const getPaymentMethodsRoute = createRoute({
    method: 'get',
    path: '/payment-methods',
    summary: 'Get Payment Methods',
    description: 'Payment method management is handled through the web customer portal.',
    responses: {
        403: { description: 'Forbidden' },
        501: { content: { 'application/json': { schema: BillingMutationUnavailableSchema } }, description: 'Not implemented' }
    }
});

billingRouter.openapi(getPaymentMethodsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    return billingMutationUnavailable(c);
});

const addPaymentMethodRoute = createRoute({
    method: 'post',
    path: '/payment-methods',
    summary: 'Add Payment Method',
    description: 'Payment method management is handled through the web customer portal.',
    responses: {
        403: { description: 'Forbidden' },
        501: { content: { 'application/json': { schema: BillingMutationUnavailableSchema } }, description: 'Not implemented' }
    }
});

billingRouter.openapi(addPaymentMethodRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);
    return billingMutationUnavailable(c);
});

const deletePaymentMethodRoute = createRoute({
    method: 'delete',
    path: '/payment-methods/{id}',
    summary: 'Delete Payment Method',
    description: 'Payment method management is handled through the web customer portal.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        403: { description: 'Forbidden' },
        501: { content: { 'application/json': { schema: BillingMutationUnavailableSchema } }, description: 'Not implemented' }
    }
});

billingRouter.openapi(deletePaymentMethodRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);
    return billingMutationUnavailable(c);
});

const setDefaultPaymentMethodRoute = createRoute({
    method: 'patch',
    path: '/payment-methods/{id}/default',
    summary: 'Set Default Payment Method',
    description: 'Payment method management is handled through the web customer portal.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        403: { description: 'Forbidden' },
        501: { content: { 'application/json': { schema: BillingMutationUnavailableSchema } }, description: 'Not implemented' }
    }
});

billingRouter.openapi(setDefaultPaymentMethodRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);
    return billingMutationUnavailable(c);
});

// =============================================================================
// SUBSCRIPTION MANAGEMENT (Admin ONLY)
// =============================================================================

const subscribeRoute = createRoute({
    method: 'post',
    path: '/subscribe',
    summary: 'Create Subscription',
    description: 'Subscription creation is handled through the web checkout flow.',
    responses: {
        403: { description: 'Forbidden' },
        501: { content: { 'application/json': { schema: BillingMutationUnavailableSchema } }, description: 'Not implemented' }
    }
});

billingRouter.openapi(subscribeRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);
    return billingMutationUnavailable(c);
});

const cancelRoute = createRoute({
    method: 'post',
    path: '/cancel',
    summary: 'Cancel Subscription',
    description: 'Subscription changes are handled through the web customer portal.',
    responses: {
        403: { description: 'Forbidden' },
        501: { content: { 'application/json': { schema: BillingMutationUnavailableSchema } }, description: 'Not implemented' }
    }
});

billingRouter.openapi(cancelRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);
    return billingMutationUnavailable(c);
});

const upgradeRoute = createRoute({
    method: 'post',
    path: '/upgrade',
    summary: 'Upgrade Plan',
    description: 'Subscription changes are handled through the web checkout flow.',
    responses: {
        403: { description: 'Forbidden' },
        501: { content: { 'application/json': { schema: BillingMutationUnavailableSchema } }, description: 'Not implemented' }
    }
});

billingRouter.openapi(upgradeRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);
    return billingMutationUnavailable(c);
});

export default billingRouter;
