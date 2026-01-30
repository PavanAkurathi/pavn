// apps/api/src/routes/billing.ts
// Billing & Payment Routes (Admin only for payment methods)

import { Hono } from "hono";
import type { AppContext } from "../index";
import { requireAdmin, requireManager } from "../middleware";

export const billingRouter = new Hono<AppContext>();

// =============================================================================
// SUBSCRIPTION / BILLING INFO (Manager can view)
// =============================================================================

billingRouter.get("/", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    
    // TODO: Implement billing info retrieval
    return c.json({
        plan: "professional",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        usage: {
            workers: 0,
            shifts: 0,
        },
    });
});

billingRouter.get("/invoices", requireManager(), async (c) => {
    // TODO: Implement invoice listing from Stripe
    return c.json({ invoices: [] });
});

billingRouter.get("/usage", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    
    // TODO: Implement usage stats
    return c.json({
        period: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
        },
        workers: { count: 0, limit: 100 },
        shifts: { count: 0, limit: 1000 },
        storage: { used: 0, limit: 10737418240 }, // 10GB in bytes
    });
});

// =============================================================================
// PAYMENT METHODS (Admin ONLY - Managers cannot CRUD)
// =============================================================================

billingRouter.get("/payment-methods", requireAdmin(), async (c) => {
    // TODO: Implement Stripe payment methods list
    return c.json({ paymentMethods: [] });
});

billingRouter.post("/payment-methods", requireAdmin(), async (c) => {
    // TODO: Implement add payment method via Stripe
    return c.json({ error: "Not yet implemented" }, 501);
});

billingRouter.delete("/payment-methods/:id", requireAdmin(), async (c) => {
    const paymentMethodId = c.req.param("id");
    // TODO: Implement delete payment method
    return c.json({ error: "Not yet implemented" }, 501);
});

billingRouter.patch("/payment-methods/:id/default", requireAdmin(), async (c) => {
    const paymentMethodId = c.req.param("id");
    // TODO: Implement set default payment method
    return c.json({ error: "Not yet implemented" }, 501);
});

// =============================================================================
// SUBSCRIPTION MANAGEMENT (Admin ONLY)
// =============================================================================

billingRouter.post("/subscribe", requireAdmin(), async (c) => {
    // TODO: Implement subscription creation via Stripe
    return c.json({ error: "Not yet implemented" }, 501);
});

billingRouter.post("/cancel", requireAdmin(), async (c) => {
    // TODO: Implement subscription cancellation
    return c.json({ error: "Not yet implemented" }, 501);
});

billingRouter.post("/upgrade", requireAdmin(), async (c) => {
    // TODO: Implement plan upgrade
    return c.json({ error: "Not yet implemented" }, 501);
});

export default billingRouter;
