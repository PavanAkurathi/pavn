/**
 * @fileoverview Geofence and Time Clock Routes
 * @module apps/api/routes/geofence
 * 
 * Handles worker clock in/out operations with GPS verification,
 * and time correction request workflows.
 * 
 * @requires @repo/geofence - Geofence business logic services
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "../index";

// Import services from geofence package
import {
    clockIn,
    clockOut,
    requestCorrection,
    getPendingCorrections,
    reviewCorrection,
    ClockActionResponseSchema,
    PendingCorrectionsResponseSchema,
} from "@repo/geofence";

export const geofenceRouter = new OpenAPIHono<AppContext>();

// =============================================================================
// CLOCK IN/OUT
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
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const result = await clockIn(body, user.id, orgId);
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
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const result = await clockOut(body, user.id, orgId);
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

    const body = await c.req.json();
    const result = await requestCorrection(body, user.id, orgId);
    return c.json(result as any, 200);
});

const getPendingCorrectionsRoute = createRoute({
    method: 'get',
    path: '/pending',
    summary: 'Get Pending Corrections',
    description: 'List pending correction requests (Manager).',
    responses: {
        200: { content: { 'application/json': { schema: PendingCorrectionsResponseSchema } }, description: 'Pending corrections' },
        403: { description: 'Forbidden' }
    }
});

geofenceRouter.openapi(getPendingCorrectionsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) {
        return c.json({ error: "Access denied" }, 403);
    }

    const orgId = c.get("orgId");
    const result = await getPendingCorrections(orgId);
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

    const body = await c.req.json();
    const result = await reviewCorrection(body, user.id, orgId);
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
