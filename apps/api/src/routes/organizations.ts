/**
 * @fileoverview Organization Routes
 * @module apps/api/routes/organizations
 * 
 * Handles organization-level operations including crew management,
 * locations, and settings.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "../index.js";

// Import from packages (Services)
import {
    getCrew,
    createLocation,
    getLocations,
    updateLocation,
    deleteLocation,
    inviteWorker,
    updateWorker,
    deactivateWorker,
    reactivateWorker,
    getSettings,
    updateSettings,
    WorkerSchema,
    LocationSchema,
} from "@repo/shifts-service";

export const organizationsRouter = new OpenAPIHono<AppContext>();

// =============================================================================
// CREW MANAGEMENT (Full Access: Admin/Manager)
// =============================================================================

const getCrewRoute = createRoute({
    method: 'get',
    path: '/crew',
    summary: 'Get Crew',
    description: 'List all workers in the organization.',
    request: {
        query: z.object({
            search: z.string().optional(),
            limit: z.string().optional(),
            offset: z.string().optional()
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.array(WorkerSchema) } }, description: 'Crew list' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(getCrewRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const search = c.req.query("search");
    const limit = parseInt(c.req.query("limit") || "50");
    const offset = parseInt(c.req.query("offset") || "0");

    const result = await getCrew(orgId, { search, limit, offset });
    return c.json(result as any, 200);
});

const inviteWorkerRoute = createRoute({
    method: 'post',
    path: '/crew/invite',
    summary: 'Invite Worker',
    description: 'Invite a new worker to the organization.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Invitation sent' },
        501: { description: 'Not implemented' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(inviteWorkerRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const result = await inviteWorker({ ...body, inviterId: user.id }, orgId);
    return c.json(result as any, 200);
});

const updateWorkerRoute = createRoute({
    method: 'patch',
    path: '/crew/{id}',
    summary: 'Update Worker',
    description: 'Update worker details.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Worker updated' },
        501: { description: 'Not implemented' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(updateWorkerRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await updateWorker(body, id, orgId);
    return c.json(result as any, 200);
});

const deactivateWorkerRoute = createRoute({
    method: 'delete',
    path: '/crew/{id}',
    summary: 'Deactivate Worker',
    description: 'Deactivate a worker account.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Worker deactivated' },
        501: { description: 'Not implemented' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(deactivateWorkerRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await deactivateWorker(id, orgId);
    return c.json(result as any, 200);
});

const reactivateWorkerRoute = createRoute({
    method: 'post',
    path: '/crew/{id}/reactivate',
    summary: 'Reactivate Worker',
    description: 'Reactivate a suspended worker account.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Worker reactivated' },
        501: { description: 'Not implemented' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(reactivateWorkerRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await reactivateWorker(id, orgId);
    return c.json(result as any, 200);
});

// =============================================================================
// LOCATIONS
// =============================================================================

const getLocationsRoute = createRoute({
    method: 'get',
    path: '/locations',
    summary: 'Get Locations',
    description: 'List all organization locations.',
    responses: {
        200: { content: { 'application/json': { schema: z.array(LocationSchema) } }, description: 'Locations list' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(getLocationsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getLocations(orgId);
    return c.json(result as any, 200);
});

const createLocationRoute = createRoute({
    method: 'post',
    path: '/locations',
    summary: 'Create Location',
    description: 'Add a new location.',
    responses: {
        200: { content: { 'application/json': { schema: LocationSchema } }, description: 'Location created' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(createLocationRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await createLocation(body, orgId);
    return c.json(result as any, 200);
});

const updateLocationRoute = createRoute({
    method: 'patch',
    path: '/locations/{id}',
    summary: 'Update Location',
    description: 'Update location details.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: LocationSchema } }, description: 'Location updated' },
        501: { description: 'Not implemented' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(updateLocationRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await updateLocation(body, id, orgId);
    return c.json(result as any, 200);
});

const deleteLocationRoute = createRoute({
    method: 'delete',
    path: '/locations/{id}',
    summary: 'Delete Location',
    description: 'Remove a location.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Location deleted' },
        501: { description: 'Not implemented' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(deleteLocationRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await deleteLocation(id, orgId);
    return c.json(result as any, 200);
});

// =============================================================================
// ORGANIZATION SETTINGS (Manager/Admin)
// =============================================================================

const updateSettingsRoute = createRoute({
    method: 'patch',
    path: '/settings',
    summary: 'Update Settings',
    description: 'Update organization settings.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Settings updated' },
        501: { description: 'Not implemented' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(updateSettingsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await updateSettings(body, orgId);
    return c.json(result as any, 200);
});

const getSettingsRoute = createRoute({
    method: 'get',
    path: '/settings',
    summary: 'Get Settings',
    description: 'Get organization settings.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Settings' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(getSettingsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (userRole !== "admin") return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    // getSettings logic in services/get-settings.ts takes orgId
    const result = await getSettings(orgId);
    return c.json(result as any, 200);
});

export default organizationsRouter;
