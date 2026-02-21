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
    getWorkerAllShifts,
    setAvailability,
    getAvailability,
    UpcomingShiftsResponseSchema,
    AvailabilityResponseSchema,
    WorkerSchema
} from "@repo/shifts-service";

import {
    requestCorrection,
    getWorkerCorrections,
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
        501: { description: 'Not implemented' }
    }
});

workerRouter.openapi(updateProfileRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();

    // Only allow updating safe fields
    const allowedFields: Record<string, any> = {};
    if (body.name && typeof body.name === 'string') allowedFields.name = body.name;
    if (body.image && typeof body.image === 'string') allowedFields.image = body.image;

    if (Object.keys(allowedFields).length === 0) {
        return c.json({ error: "No valid fields to update" }, 400);
    }

    const { db, eq } = await import("@repo/database");
    const { user: userTable } = await import("@repo/database/schema");

    const [updated] = await db.update(userTable)
        .set({ ...allowedFields, updatedAt: new Date() })
        .where(eq(userTable.id, user.id))
        .returning();

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

    const { db, eq, and } = await import("@repo/database");
    const { member, organization } = await import("@repo/database/schema");

    const memberships = await db
        .select({
            orgId: member.organizationId,
            role: member.role,
            orgName: organization.name,
            orgLogo: organization.logo,
        })
        .from(member)
        .innerJoin(organization, eq(member.organizationId, organization.id))
        .where(and(
            eq(member.userId, user.id),
            eq(member.status, 'active')
        ));

    return c.json({
        organizations: memberships.map(m => ({
            id: m.orgId,
            name: m.orgName,
            logo: m.orgLogo,
            role: m.role,
        }))
    } as any, 200);
});
