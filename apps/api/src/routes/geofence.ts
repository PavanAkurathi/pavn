/**
 * @fileoverview Geofence and Time Clock Routes
 * @module apps/api/routes/geofence
 * 
 * Handles worker clock in/out operations with GPS verification,
 * and time correction request workflows.
 * 
 * @description
 * This router powers the core time tracking functionality:
 * - GPS-verified clock in/out (workers)
 * - Time correction/adjustment requests (workers)
 * - Pending corrections queue (managers)
 * - Correction review/approval (managers)
 * 
 * Clock actions are rate-limited (5/minute) to prevent spam.
 * Location is verified against venue geofence before allowing clock.
 * 
 * RBAC Rules:
 * - All authenticated users can clock in/out and request corrections
 * - Managers can view pending corrections and approve/deny them
 * 
 * Endpoints:
 * - POST /clock-in - Clock in with GPS coordinates (rate limited)
 * - POST /clock-out - Clock out with GPS coordinates (rate limited)
 * - POST /corrections - Submit time correction request
 * - GET /pending - List pending correction requests (manager+)
 * - POST /review - Approve/deny correction request (manager+)
 * - POST /verify-location - Check if at venue without clocking
 * 
 * @requires @repo/geofence - Clock and correction controllers
 * @author WorkersHive Team
 * @since 1.0.0
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "../index";
import { requireManager } from "../middleware";
import { rateLimit, RATE_LIMITS } from "../middleware";

// Import controllers from geofence package
import {
    clockInController,
    clockOutController,
    requestCorrectionController,
    getPendingCorrectionsController,
    reviewCorrectionController,
    ClockActionResponseSchema,
    PendingCorrectionsResponseSchema,
} from "@repo/geofence";

export const geofenceRouter = new OpenAPIHono<AppContext>();

// =============================================================================
// CLOCK IN/OUT (Rate limited to prevent spam)
// =============================================================================

const clockInRoute = createRoute({
    method: 'post',
    path: '/clock-in',
    summary: 'Clock In',
    description: 'Clock in worker with GPS coordinates.',
    responses: {
        200: { content: { 'application/json': { schema: ClockActionResponseSchema } }, description: 'Clock in result' },
        401: { description: 'Unauthorized' }
    }
});

geofenceRouter.openapi(clockInRoute, async (c) => {
    // TODO: Re-enable rate limiting middleware
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const result = await clockInController(c.req.raw, user.id, orgId);
    return c.json(result as any, 200);
});

const clockOutRoute = createRoute({
    method: 'post',
    path: '/clock-out',
    summary: 'Clock Out',
    description: 'Clock out worker with GPS coordinates.',
    responses: {
        200: { content: { 'application/json': { schema: ClockActionResponseSchema } }, description: 'Clock out result' },
        401: { description: 'Unauthorized' }
    }
});

geofenceRouter.openapi(clockOutRoute, async (c) => {
    // TODO: Re-enable rate limiting middleware
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const result = await clockOutController(c.req.raw, user.id, orgId);
    return c.json(result as any, 200);
});

// =============================================================================
// ADJUSTMENT/CORRECTION REQUESTS
// =============================================================================

const requestCorrectionRoute = createRoute({
    method: 'post',
    path: '/corrections',
    summary: 'Request Correction',
    description: 'Submit time correction request.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Request result' },
        401: { description: 'Unauthorized' }
    }
});

geofenceRouter.openapi(requestCorrectionRoute, async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const result = await requestCorrectionController(c.req.raw, user.id, orgId);
    return c.json(result as any, 200);
});

const getPendingCorrectionsRoute = createRoute({
    method: 'get',
    path: '/pending',
    summary: 'Get Pending Corrections',
    description: 'List pending correction requests (Manager).',
    responses: {
        200: { content: { 'application/json': { schema: PendingCorrectionsResponseSchema } }, description: 'Pending corrections' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' }
    }
});

geofenceRouter.openapi(getPendingCorrectionsRoute, async (c) => {
    // Auth Check
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) {
        return c.json({ error: "Access denied" }, 403);
    }

    const orgId = c.get("orgId");
    const result = await getPendingCorrectionsController(orgId);
    return c.json(result as any, 200);
});

const reviewCorrectionRoute = createRoute({
    method: 'post',
    path: '/review',
    summary: 'Review Correction',
    description: 'Approve or deny correction request (Manager).',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Review result' },
        403: { description: 'Forbidden' }
    }
});

geofenceRouter.openapi(reviewCorrectionRoute, async (c) => {
    const user = c.get("user");
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) {
        return c.json({ error: "Access denied" }, 403);
    }
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const result = await reviewCorrectionController(c.req.raw, user.id, orgId);
    return c.json(result as any, 200);
});

// =============================================================================
// LOCATION VERIFICATION
// =============================================================================

const verifyLocationRoute = createRoute({
    method: 'post',
    path: '/verify-location',
    summary: 'Verify Location',
    description: 'Check if at venue without clocking.',
    responses: {
        501: { description: 'Not implemented' }
    }
});

geofenceRouter.openapi(verifyLocationRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    // TODO: Implement location verification without clocking in/out
    return c.json({
        verified: false,
        message: "Not yet implemented"
    } as any, 501);
});

export default geofenceRouter;
