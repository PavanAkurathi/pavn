/**
 * @fileoverview Organization Routes
 * @module apps/api/routes/organizations
 * 
 * Handles organization-level operations including crew management,
 * locations, and settings.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "../index.js";
import { requireAdmin, requireManager } from "../middleware/index.js";

// Import from packages
import {
    getCrewController,
    createLocationController,
    getLocationsController,
    updateLocationController,
    deleteLocationController,
    inviteWorkerController,
    updateWorkerController,
    deactivateWorkerController,
    reactivateWorkerController,
    getSettingsController,
    updateSettingsController,
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
    responses: {
        200: { content: { 'application/json': { schema: z.array(WorkerSchema) } }, description: 'Crew list' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(getCrewRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getCrewController(orgId);
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
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const result = await inviteWorkerController({ ...body, inviterId: user.id }, orgId);
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
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await updateWorkerController(body, id, orgId);
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
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await deactivateWorkerController(id, orgId);
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
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await reactivateWorkerController(id, orgId);
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
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getLocationsController(orgId);
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
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await createLocationController(c.req.raw, orgId);
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
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await updateLocationController(body, id, orgId);
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
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await deleteLocationController(id, orgId);
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
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await updateSettingsController(body, orgId);
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
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getSettingsController(orgId);
    return c.json(result as any, 200);
});

export default organizationsRouter;
