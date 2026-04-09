/**
 * @fileoverview Worker-Facing Routes
 * @module apps/api/routes/worker
 * 
 * Endpoints for workers (members) to view their shifts, set availability,
 * submit adjustment requests, and manage their profile.
 * 
 * @requires @repo/scheduling-timekeeping
 * @requires @repo/geofence
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { UpcomingShiftsResponseSchema } from "@repo/contracts/shifts";
import {
    AvailabilityResponseSchema,
    WorkerSchema,
} from "@repo/contracts/workforce";
import type { AppContext } from "../index";
import { getWorkerPhoneAccess } from "@repo/auth";

// Import services
import {
    getWorkerShifts,
    getWorkerShiftById,
    getWorkerAllShifts,
} from "@repo/scheduling-timekeeping";
import {
    getAvailability,
    getWorkerOrganizations,
    setAvailability,
    updateWorkerProfile,
} from "@repo/gig-workers";

import {
    requestCorrection,
    getWorkerCorrections,
    CorrectionRequestSchema
} from "@repo/geofence";

export const workerRouter = new OpenAPIHono<AppContext>();

const workerAuthEligibilityRoute = createRoute({
    method: "post",
    path: "/auth/eligibility",
    summary: "Check Worker Phone Eligibility",
    description: "Check whether a phone number has already been added to at least one organization and can use the worker app.",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: z.object({
                        phoneNumber: z.string(),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: "Eligibility check result",
            content: {
                "application/json": {
                    schema: z.object({
                        eligible: z.boolean(),
                        organizationCount: z.number().int().nonnegative(),
                        existingAccount: z.boolean(),
                    }),
                },
            },
        },
        400: { description: "Invalid phone number" },
    },
});

workerRouter.openapi(workerAuthEligibilityRoute, async (c) => {
    const body = await c.req.json();
    if (!body || typeof body.phoneNumber !== "string") {
        return c.json({ error: "Invalid phone number" }, 400);
    }

    try {
        const access = await getWorkerPhoneAccess(body.phoneNumber);
        return c.json({
            eligible: access.eligible,
            organizationCount: access.organizationCount,
            existingAccount: access.existingAccount,
        }, 200);
    } catch {
        return c.json({ error: "Invalid phone number" }, 400);
    }
});

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

const getShiftDetailRoute = createRoute({
    method: 'get',
    path: '/shifts/{id}',
    summary: 'Get Worker Shift Detail',
    description: 'Get detailed shift information for the current worker within the active organization.',
    request: {
        params: z.object({
            id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': { schema: z.any() }
            },
            description: 'Worker shift detail'
        },
        401: { description: 'Unauthorized' },
        404: { description: 'Shift not found' }
    }
});

workerRouter.openapi(getShiftDetailRoute, async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const shiftId = c.req.param("id");
    const result = await getWorkerShiftById(user.id, shiftId, orgId);
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

    const orgId = c.get("orgId");
    const result = await getWorkerCorrections(user.id, orgId);
    return c.json(result as any, 200);
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

    const userRole = c.get("userRole");

    return c.json({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: userRole || "member",
        status: "active"
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
        400: { description: 'Invalid request' },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(updateProfileRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    let updated = null;
    try {
        updated = await updateWorkerProfile(user.id, body);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid request";
        return c.json({ error: message }, 400);
    }

    if (!updated) {
        return c.json({ error: "Failed to update profile" }, 400);
    }

    return c.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        image: updated.image,
        role: "member",
        status: "active"
    } as any, 200);
});

export default workerRouter;

// =============================================================================
// CROSS-ORG ROUTES (no x-org-id required — query all memberships)
// =============================================================================

const allShiftsRoute = createRoute({
    method: 'get',
    path: '/all-shifts',
    summary: 'Get All Shifts (Cross-Org)',
    description: 'Get worker shifts across ALL organizations they belong to. Includes conflict detection for overlapping shifts.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Shifts from all orgs' },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(allShiftsRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const status = (c.req.query("status") || 'upcoming') as 'upcoming' | 'history' | 'in-progress' | 'all';
    const orgId = c.req.query("orgId") || undefined;
    const limit = parseInt(c.req.query("limit") || '50');
    const offset = parseInt(c.req.query("offset") || '0');

    const result = await getWorkerAllShifts(user.id, { status, orgId, limit, offset });
    return c.json(result as any, 200);
});

const workerOrgsRoute = createRoute({
    method: 'get',
    path: '/organizations',
    summary: 'Get Worker Organizations',
    description: 'List all organizations the worker belongs to.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Organization memberships' },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(workerOrgsRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const organizations = await getWorkerOrganizations(user.id);

    return c.json({
        organizations,
    } as any, 200);
});
