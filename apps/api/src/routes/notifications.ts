/**
 * @fileoverview Notification Dispatch & Bulk Import Routes
 * @module apps/api/routes/notifications
 * 
 * Handles notification processing (cron endpoint) and worker bulk import.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "../index";
import { dispatchPendingNotifications } from "@repo/notifications";
import { bulkImportWorkers, parseWorkerFile } from "@repo/shifts-service";

export const notificationsRouter = new OpenAPIHono<AppContext>();

// =============================================================================
// NOTIFICATION DISPATCH (Cron endpoint)
// =============================================================================

const dispatchRoute = createRoute({
    method: 'post',
    path: '/dispatch',
    summary: 'Process Pending Notifications',
    description: 'Processes all pending scheduled notifications whose send time has passed. Call this on a 1-minute cron schedule.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Dispatch results' },
        403: { description: 'Forbidden' }
    }
});

notificationsRouter.openapi(dispatchRoute, async (c) => {
    // Admin only — or allow via cron secret header
    const userRole = c.get("userRole");
    const cronSecret = c.req.header("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET;

    // Allow if admin OR if cron secret matches
    if (userRole !== "admin" && (!expectedSecret || cronSecret !== expectedSecret)) {
        return c.json({ error: "Access denied" }, 403);
    }

    const result = await dispatchPendingNotifications();
    return c.json(result as any, 200);
});

// =============================================================================
// BULK WORKER IMPORT
// =============================================================================

const bulkImportRoute = createRoute({
    method: 'post',
    path: '/bulk-import',
    summary: 'Bulk Import Workers',
    description: 'Import workers from CSV data. Expects JSON array of worker rows with name, email, phone fields.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Import results' },
        403: { description: 'Forbidden' }
    }
});

notificationsRouter.openapi(bulkImportRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const body = await c.req.json();

    // Body should be { rows: [...] } with parsed worker data
    // The web UI parses CSV → JSON via parseWorkerFile before sending
    if (!body.rows || !Array.isArray(body.rows)) {
        return c.json({ error: "Expected { rows: [...] } with worker data" }, 400);
    }

    const result = await bulkImportWorkers(orgId, body.rows);
    return c.json(result as any, 200);
});

export default notificationsRouter;
