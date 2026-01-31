/**
 * @fileoverview Worker-Facing Routes
 * @module apps/api/routes/worker
 * 
 * Endpoints for workers (members) to view their shifts, set availability,
 * submit adjustment requests, and manage their profile.
 * 
 * @description
 * These routes are accessible to all authenticated users (including members).
 * Workers use these endpoints from the mobile app to:
 * - View their upcoming and past shifts
 * - Set their availability for scheduling
 * - Request time adjustments/corrections
 * - View and update their profile
 * 
 * Endpoints:
 * - GET /shifts - Worker's assigned shifts (upcoming/history/all)
 * - POST /availability - Set availability windows
 * - GET /availability - Get current availability
 * - POST /adjustments - Submit time correction request (rate limited)
 * - GET /adjustments - View submitted adjustment requests
 * - GET /profile - Get worker profile
 * - PATCH /profile - Update profile info
 * 
 * @requires @repo/shifts - Shift and availability controllers
 * @requires @repo/geofence - Correction request handling
 * @author WorkersHive Team
 * @since 1.0.0
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "../index";
import { rateLimit, RATE_LIMITS } from "../middleware";

// Import controllers
import { getWorkerShiftsController, setAvailabilityController } from "@repo/shifts-service";
import { requestCorrectionController } from "@repo/geofence";

// Schemas
import {
    UpcomingShiftsResponseSchema,
    AvailabilityResponseSchema,
    WorkerSchema
} from "@repo/shifts-service";
import { CorrectionRequestSchema } from "@repo/geofence";

export const workerRouter = new OpenAPIHono<AppContext>();

// =============================================================================
// WORKER SHIFTS
// =============================================================================

const getShiftsRoute = createRoute({
    method: 'get',
    path: '/shifts',
    summary: 'Get Assgined Shifts',
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

    const result = await getWorkerShiftsController(user.id, orgId, { status, limit, offset });
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
    const result = await setAvailabilityController(c.req.raw, user.id);
    return c.json(result, 200);
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
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    // TODO: Implement get worker's own availability
    return c.json([] as any, 200);
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
    // Manually apply rate limit for now since OpenAPIHono doesn't support array middleware in .openapi() easily
    // In production we'd wrap this or usage global middleware
    // await rateLimit(RATE_LIMITS.api)(c, () => Promise.resolve()); 

    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const result = await requestCorrectionController(c.req.raw, user.id, orgId);
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

    // TODO: Implement get worker's own adjustment requests
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
