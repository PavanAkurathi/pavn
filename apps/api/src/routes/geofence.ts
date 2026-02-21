/**
 * @fileoverview Geofence and Time Clock Routes
 * @module apps/api/routes/geofence
 * 
 * Handles worker clock in/out operations with GPS verification,
 * manager overrides, location ingestion, flagged timesheets,
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
    managerOverride,
    getFlaggedTimesheets,
    ingestLocation,
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
// LOCATION INGESTION (Background pings from mobile)
// =============================================================================

const ingestLocationRoute = createRoute({
    method: 'post',
    path: '/location',
    summary: 'Ingest Location Ping',
    description: 'Receive background location update from worker mobile app. Used for arrival detection and geofence monitoring.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Location processed' },
        401: { description: 'Unauthorized' }
    }
});

geofenceRouter.openapi(ingestLocationRoute, async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const result = await ingestLocation(body, user.id, orgId);
    return c.json(result as any, 200);
});

// =============================================================================
// MANAGER OVERRIDE
// =============================================================================

const managerOverrideRoute = createRoute({
    method: 'post',
    path: '/manager-override',
    summary: 'Manager Override',
    description: 'Manager manually sets or corrects clock-in/out times for a worker. No snapping rules applied — exact times are trusted.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Override applied' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — admin role required' }
    }
});

geofenceRouter.openapi(managerOverrideRoute, async (c) => {
    const user = c.get("user");
    const userRole = c.get("userRole");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    // Service does its own admin check, but fail fast at route level
    if (userRole !== "admin") {
        return c.json({ error: "Admin role required" }, 403);
    }

    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await managerOverride(body, user.id, orgId);
    return c.json(result as any, 200);
});

// =============================================================================
// FLAGGED TIMESHEETS
// =============================================================================

const getFlaggedTimesheetsRoute = createRoute({
    method: 'get',
    path: '/flagged',
    summary: 'Get Flagged Timesheets',
    description: 'List assignments that need review (missing clock-in/out, geofence violations, pending corrections). Admin only.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Flagged timesheets and pending corrections' },
        403: { description: 'Forbidden' }
    }
});

geofenceRouter.openapi(getFlaggedTimesheetsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") {
        return c.json({ error: "Admin role required" }, 403);
    }

    const orgId = c.get("orgId");
    const result = await getFlaggedTimesheets(orgId);
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
    description: 'List pending correction requests (Admin).',
    responses: {
        200: { content: { 'application/json': { schema: PendingCorrectionsResponseSchema } }, description: 'Pending corrections' },
        403: { description: 'Forbidden' }
    }
});

geofenceRouter.openapi(getPendingCorrectionsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") {
        return c.json({ error: "Admin role required" }, 403);
    }

    const orgId = c.get("orgId");
    const result = await getPendingCorrections(orgId);
    return c.json(result as any, 200);
});

const reviewCorrectionRoute = createRoute({
    method: 'post',
    path: '/review',
    summary: 'Review Correction',
    description: 'Approve or deny correction request (Admin).',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Review result' },
        403: { description: 'Forbidden' }
    }
});

geofenceRouter.openapi(reviewCorrectionRoute, async (c) => {
    const user = c.get("user");
    const userRole = c.get("userRole");
    if (userRole !== "admin") {
        return c.json({ error: "Admin role required" }, 403);
    }
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const orgId = c.get("orgId");
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
    description: 'Check if worker is at venue without clocking in. Uses PostGIS ST_DWithin for server-side geofence check.',
    responses: {
        501: { description: 'Not implemented' }
    }
});

geofenceRouter.openapi(verifyLocationRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    // TODO: Implement server-side geofence verification using PostGIS
    // Accept {shiftId, latitude, longitude} → return {verified: boolean, distance: number}
    return c.json({
        verified: false,
        message: "Not yet implemented"
    } as any, 501);
});

export default geofenceRouter;
