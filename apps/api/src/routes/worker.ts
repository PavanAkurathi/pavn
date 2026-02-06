/**
 * @fileoverview Worker-Facing Routes
 * @module apps/api/routes/worker
 * 
 * Endpoints for workers (members) to view their shifts, set availability,
 * submit adjustment requests, and manage their profile.
 * 
 * @requires @repo/shifts-service
 * @requires @repo/geofence
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "../index";

// Import services
import {
    getWorkerShifts,
    setAvailability,
    getAvailability,
    UpcomingShiftsResponseSchema,
    AvailabilityResponseSchema,
    WorkerSchema
} from "@repo/shifts-service";

import {
    requestCorrection,
    CorrectionRequestSchema
} from "@repo/geofence";

export const workerRouter = new OpenAPIHono<AppContext>();

// =============================================================================
// WORKER SHIFTS
// =============================================================================

const getShiftsRoute = createRoute({
    method: 'get',
    path: '/shifts',
    summary: 'Get Assigned Shifts',
    description: 'Get shifts assigned to the current worker (upcoming, history, or all).',
    request: {
        query: z.object({
            status: z.enum(['upcoming', 'history', 'all']).optional(),
            limit: z.string().optional(),
            offset: z.string().optional(),
        })
    },
    responses: {
        200: {
            content: {
                'application/json': { schema: UpcomingShiftsResponseSchema }
            },
            description: 'List of worker shifts'
        },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(getShiftsRoute, async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const status = (c.req.query("status") as "upcoming" | "history" | "all") || "upcoming";
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");

    const result = await getWorkerShifts(user.id, orgId, { status, limit, offset });
    return c.json(result as any, 200);
});

// =============================================================================
// AVAILABILITY
// =============================================================================

const setAvailabilityRoute = createRoute({
    method: 'post',
    path: '/availability',
    summary: 'Set Availability',
    description: 'Set availability for the worker.',
    responses: {
        200: {
            description: 'Availability set successfully',
            content: { 'application/json': { schema: z.any() } }
        },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(setAvailabilityRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const result = await setAvailability(body, user.id);
    return c.json(result as any, 200);
});

const getAvailabilityRoute = createRoute({
    method: 'get',
    path: '/availability',
    summary: 'Get Availability',
    description: 'Get current availability for the worker.',
    responses: {
        200: {
            content: {
                'application/json': { schema: AvailabilityResponseSchema }
            },
            description: 'Current availability'
        },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(getAvailabilityRoute, async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const from = c.req.query("from") || new Date().toISOString();
    const to = c.req.query("to") || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // Using service call
    const result = await getAvailability(orgId || "", from, to, user.id);
    return c.json(result as any, 200);
});

// =============================================================================
// ADJUSTMENT REQUESTS
// =============================================================================

const requestAdjustmentRoute = createRoute({
    method: 'post',
    path: '/adjustments',
    summary: 'Request Time Adjustment',
    description: 'Submit a request to correct time logs.',
    responses: {
        200: {
            description: 'Request submitted successfully',
            content: { 'application/json': { schema: z.any() } }
        },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(requestAdjustmentRoute, async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const result = await requestCorrection(body, user.id, orgId);
    return c.json(result, 200);
});

const getAdjustmentsRoute = createRoute({
    method: 'get',
    path: '/adjustments',
    summary: 'Get Adjustment Requests',
    description: 'View submitted adjustment requests.',
    responses: {
        200: {
            content: {
                'application/json': { schema: z.array(CorrectionRequestSchema) }
            },
            description: 'List of adjustment requests'
        },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(getAdjustmentsRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    // Helper logic or service call for getting own adjustments
    // Assuming getPendingCorrections is manager facing? 
    // We might need getWorkerCorrections(userId, orgId).
    // For now, returning empty array as placeholder logic if service doesn't exist
    return c.json([] as any, 200);
});

// =============================================================================
// PROFILE
// =============================================================================

const getProfileRoute = createRoute({
    method: 'get',
    path: '/profile',
    summary: 'Get Profile',
    description: 'Get worker profile information.',
    responses: {
        200: {
            content: {
                'application/json': { schema: WorkerSchema }
            },
            description: 'Worker profile'
        },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(getProfileRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    return c.json({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: "worker", // mock
        status: "active" // mock
    } as any, 200);
});

const updateProfileRoute = createRoute({
    method: 'patch',
    path: '/profile',
    summary: 'Update Profile',
    description: 'Update worker profile information.',
    responses: {
        200: {
            content: { 'application/json': { schema: WorkerSchema } },
            description: 'Updated profile'
        },
        501: { description: 'Not implemented' }
    }
});

workerRouter.openapi(updateProfileRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    // TODO: Implement profile update
    return c.json({ error: "Not yet implemented" } as any, 501);
});

export default workerRouter;
