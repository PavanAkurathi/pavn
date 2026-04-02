import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "../index";
import { isAdminRole } from "../lib/organization-roles.js";
import {
    BillingInfoSchema,
    InvoiceHistorySchema,
    getOrganizationSubscription,
    listOrganizationInvoices,
} from "@repo/billing";

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
