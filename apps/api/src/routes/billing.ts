/** 

 * @fileoverview Billing and Payment Routes
 * @module apps/api/routes/billing
 * 
 * Handles subscription management, billing info, invoices, and payment methods.
 * Payment method CRUD operations are restricted to admin role only.
 * 
 * @description
 * This router manages the financial/subscription aspects of WorkersHive:
 * - Viewing billing info and usage (manager+)
 * - Invoice history (manager+)
 * - Payment method management (admin only)
 * - Subscription upgrades/cancellation (admin only)
 * 
 * RBAC Rules:
 * - Managers can VIEW billing info, invoices, usage
 * - Admins can MODIFY payment methods and subscriptions
 * 
 * Endpoints:
 * - GET / - Current billing/subscription info
 * - GET /invoices - Invoice history
 * - GET /usage - Current period usage stats
 * - GET /payment-methods - List payment methods (admin)
 * - POST /payment-methods - Add payment method (admin)
 * - DELETE /payment-methods/:id - Remove payment method (admin)
 * - PATCH /payment-methods/:id/default - Set default (admin)
 * - POST /subscribe - Create subscription (admin)
 * - POST /cancel - Cancel subscription (admin)
 * - POST /upgrade - Upgrade plan (admin)
 * 
 * @author WorkersHive Team
 * @since 1.0.0
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "../index";
import { BillingInfoSchema } from "@repo/scheduling-timekeeping";

export const billingRouter = new OpenAPIHono<AppContext>();

const billingUnavailable = (c: any) =>
    c.json({ error: "Billing API is not enabled in this build" } as any, 503);

// =============================================================================
// SUBSCRIPTION / BILLING INFO (Manager can view)
// =============================================================================

const getBillingRoute = createRoute({
    method: 'get',
    path: '/',
    summary: 'Get Billing Info',
    description: 'Get current subscription and billing status.',
    responses: {
        200: { content: { 'application/json': { schema: BillingInfoSchema } }, description: 'Billing info' },
        403: { description: 'Forbidden' },
        503: { description: 'Billing API unavailable' }
    }
});

billingRouter.openapi(getBillingRoute, async (c) => {
    // Auth check (Manager)
    const userRole = c.get("userRole");
    if (userRole !== "admin") {
        return c.json({ error: "Access denied" }, 403);
    }

    return billingUnavailable(c);
});

const getInvoicesRoute = createRoute({
    method: 'get',
    path: '/invoices',
    summary: 'Get Invoices',
    description: 'Get invoice history.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Invoices' },
        403: { description: 'Forbidden' },
        503: { description: 'Billing API unavailable' }
    }
});

billingRouter.openapi(getInvoicesRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    return billingUnavailable(c);
});

const getUsageRoute = createRoute({
    method: 'get',
    path: '/usage',
    summary: 'Get Usage Stats',
    description: 'Get current billing period usage.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Usage stats' },
        403: { description: 'Forbidden' },
        503: { description: 'Billing API unavailable' }
    }
});

billingRouter.openapi(getUsageRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    return billingUnavailable(c);
});

// =============================================================================
// PAYMENT METHODS (Admin ONLY - Managers cannot CRUD)
// =============================================================================

const getPaymentMethodsRoute = createRoute({
    method: 'get',
    path: '/payment-methods',
    summary: 'Get Payment Methods',
    description: 'List payment methods (Admin only).',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Payment methods' },
        403: { description: 'Forbidden' },
        503: { description: 'Billing API unavailable' }
    }
});

billingRouter.openapi(getPaymentMethodsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    return billingUnavailable(c);
});

const addPaymentMethodRoute = createRoute({
    method: 'post',
    path: '/payment-methods',
    summary: 'Add Payment Method',
    description: 'Add a new payment method (Admin only).',
    responses: {
        403: { description: 'Forbidden' },
        503: { description: 'Billing API unavailable' }
    }
});

billingRouter.openapi(addPaymentMethodRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);
    return billingUnavailable(c);
});

const deletePaymentMethodRoute = createRoute({
    method: 'delete',
    path: '/payment-methods/{id}',
    summary: 'Delete Payment Method',
    description: 'Delete a payment method (Admin only).',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        403: { description: 'Forbidden' },
        503: { description: 'Billing API unavailable' }
    }
});

billingRouter.openapi(deletePaymentMethodRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);
    return billingUnavailable(c);
});

const setDefaultPaymentMethodRoute = createRoute({
    method: 'patch',
    path: '/payment-methods/{id}/default',
    summary: 'Set Default Payment Method',
    description: 'Set default payment method (Admin only).',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        403: { description: 'Forbidden' },
        503: { description: 'Billing API unavailable' }
    }
});

billingRouter.openapi(setDefaultPaymentMethodRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);
    return billingUnavailable(c);
});

// =============================================================================
// SUBSCRIPTION MANAGEMENT (Admin ONLY)
// =============================================================================

const subscribeRoute = createRoute({
    method: 'post',
    path: '/subscribe',
    summary: 'Create Subscription',
    description: 'Create a new subscription (Admin only).',
    responses: {
        403: { description: 'Forbidden' },
        503: { description: 'Billing API unavailable' }
    }
});

billingRouter.openapi(subscribeRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);
    return billingUnavailable(c);
});

const cancelRoute = createRoute({
    method: 'post',
    path: '/cancel',
    summary: 'Cancel Subscription',
    description: 'Cancel current subscription (Admin only).',
    responses: {
        403: { description: 'Forbidden' },
        503: { description: 'Billing API unavailable' }
    }
});

billingRouter.openapi(cancelRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);
    return billingUnavailable(c);
});

const upgradeRoute = createRoute({
    method: 'post',
    path: '/upgrade',
    summary: 'Upgrade Plan',
    description: 'Upgrade subscription plan (Admin only).',
    responses: {
        403: { description: 'Forbidden' },
        503: { description: 'Billing API unavailable' }
    }
});

billingRouter.openapi(upgradeRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);
    return billingUnavailable(c);
});

export default billingRouter;
