/**
 * @fileoverview Shift Management Routes
 * @module apps/api/routes/shifts
 * 
 * Handles all shift-related operations for managers including draft management,
 * shift lists, approvals, assignments, and schedule publishing.
 * 
 * @description
 * This router provides the core scheduling functionality for WorkersHive.
 * Most endpoints require manager role or above. Business logic is delegated
 * to services in @repo/scheduling-timekeeping package.
 * 
 * @requires @repo/scheduling-timekeeping - Shift business logic services
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "../index";
import { requireManager, rateLimit, RATE_LIMITS } from "../middleware";
import { isManagerRole } from "../lib/organization-roles.js";
import {
    OpenApiLooseArraySchema,
    OpenApiLooseObjectSchema,
} from "../lib/openapi-schemas.js";
import { jsonOk } from "../lib/response.js";

// Import services from packages (pure business logic)
import {
    getUpcomingShifts,
    getPendingShifts,
    getHistoryShifts,
    getDraftShifts,
    deleteDrafts,
    getShiftById,
    getShiftGroup,
    approveShift,
    cancelShift,
    assignWorker,
    getShiftTimesheets,
    updateTimesheet,
    publishSchedule,
    editShift,
    duplicateShift,
    getOpenShifts,
    unassignWorker,
} from "@repo/scheduling-timekeeping";

export const shiftsRouter = new OpenAPIHono<AppContext>();

// =============================================================================
// DRAFT SHIFTS
// =============================================================================

const getDraftsRoute = createRoute({
    method: 'get',
    path: '/drafts',
    summary: 'Get Draft Shifts',
    description: 'Get all shifts in draft status.',
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseArraySchema } }, description: 'Draft shifts' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(getDraftsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getDraftShifts(orgId);
    return jsonOk(c, result);
});

const deleteDraftsRoute = createRoute({
    method: 'delete',
    path: '/drafts',
    summary: 'Delete Draft Shifts',
    description: 'Clear all draft shifts.',
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } }, description: 'Drafts deleted' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(deleteDraftsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await deleteDrafts(orgId);
    return c.json(result, 200);
});

// =============================================================================
// SHIFT LISTS
// =============================================================================

const upcomingRoute = createRoute({
    method: 'get',
    path: '/upcoming',
    summary: 'Get Upcoming Shifts',
    description: 'Retrieve a list of future published shifts for the organization.',
    responses: {
        200: {
            content: { 'application/json': { schema: OpenApiLooseArraySchema } },
            description: 'List of upcoming shifts',
        },
        403: { description: 'Access denied' },
    },
});

shiftsRouter.openapi(upcomingRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) {
        return c.json({ error: "Access denied" }, 403);
    }

    const orgId = c.get("orgId");
    const result = await getUpcomingShifts(orgId);
    return jsonOk(c, result);
});

const getPendingRoute = createRoute({
    method: 'get',
    path: '/pending-approval',
    summary: 'Get Pending Shifts',
    description: 'Get shifts waiting for approval.',
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseArraySchema } }, description: 'Pending shifts' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(getPendingRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getPendingShifts(orgId);
    return jsonOk(c, result);
});

const getHistoryRoute = createRoute({
    method: 'get',
    path: '/history',
    summary: 'Get Shift History',
    description: 'Get past shifts.',
    request: {
        query: z.object({
            limit: z.string().optional(),
            offset: z.string().optional()
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseArraySchema } }, description: 'Shift history' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(getHistoryRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "50"), 1), 100);
    const offset = Math.max(parseInt(c.req.query("offset") || "0"), 0);
    const result = await getHistoryShifts(orgId, { limit, offset });
    return jsonOk(c, result);
});

// =============================================================================
// SHIFT GROUPS
// =============================================================================

const getGroupRoute = createRoute({
    method: 'get',
    path: '/groups/{groupId}',
    summary: 'Get Shift Group',
    description: 'Get details of a shift group.',
    request: { params: z.object({ groupId: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseObjectSchema } }, description: 'Shift group' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(getGroupRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const groupId = c.req.param("groupId");
    const orgId = c.get("orgId");
    const result = await getShiftGroup(groupId, orgId);
    return jsonOk(c, result);
});

// =============================================================================
// SINGLE SHIFT OPERATIONS
// =============================================================================

const getShiftRoute = createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get Shift',
    description: 'Get shift details.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseObjectSchema } }, description: 'Shift details' }
    }
});

shiftsRouter.openapi(getShiftRoute, async (c) => {
    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await getShiftById(id, orgId);
    return jsonOk(c, result);
});

const approveShiftRoute = createRoute({
    method: 'post',
    path: '/{id}/approve',
    summary: 'Approve Shift',
    description: 'Approve a pending shift.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseObjectSchema } }, description: 'Shift approved' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(approveShiftRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const result = await approveShift(id, orgId, user.id);
    return jsonOk(c, result);
});

const cancelShiftRoute = createRoute({
    method: 'post',
    path: '/{id}/cancel',
    summary: 'Cancel Shift',
    description: 'Cancel a shift.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseObjectSchema } }, description: 'Shift canceled' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(cancelShiftRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const result = await cancelShift(id, orgId, user.id);
    return jsonOk(c, result);
});

const assignWorkerRoute = createRoute({
    method: 'post',
    path: '/{id}/assign',
    summary: 'Assign Worker',
    description: 'Assign a worker to a shift.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseObjectSchema } }, description: 'Worker assigned' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(assignWorkerRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const body = await c.req.json();

    const result = await assignWorker(body, id, orgId, undefined, c.req.query("force") === "true");
    return jsonOk(c, result);
});

// =============================================================================
// SHIFT TIMESHEETS
// =============================================================================

const getShiftTimesheetsRoute = createRoute({
    method: 'get',
    path: '/{id}/timesheets',
    summary: 'Get Shift Timesheets',
    description: 'Get timesheets for a shift.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseArraySchema } }, description: 'Timesheets' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(getShiftTimesheetsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await getShiftTimesheets(id, orgId);
    return jsonOk(c, result);
});

const updateTimesheetRoute = createRoute({
    method: 'patch',
    path: '/{shiftId}/timesheet',
    summary: 'Update Timesheet',
    description: 'Update a timesheet entry.',
    request: { params: z.object({ shiftId: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseObjectSchema } }, description: 'Timesheet updated' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(updateTimesheetRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const user = c.get("user");
    const shiftId = c.req.param("shiftId");
    const body = await c.req.json();

    if (body?.shiftId && body.shiftId !== shiftId) {
        return c.json({ error: "Shift ID mismatch" }, 400);
    }

    const result = await updateTimesheet({ ...body, shiftId }, orgId, user?.id || "system");
    return jsonOk(c, result);
});

// =============================================================================
// SCHEDULE PUBLISHING
// =============================================================================

const publishRoute = createRoute({
    method: 'post',
    path: '/publish',
    summary: 'Publish Schedule',
    description: 'Publish draft shifts.',
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseObjectSchema } }, description: 'Schedule published' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.use('/publish', rateLimit(RATE_LIMITS.publish));
shiftsRouter.openapi(publishRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const body = await c.req.json();

    // publishSchedule(body, headerOrgId)
    const result = await publishSchedule(body, orgId);
    return jsonOk(c, result);
});

export default shiftsRouter;

// =============================================================================
// EDIT SHIFT
// =============================================================================

const editShiftRoute = createRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Edit Shift',
    description: 'Update a published/draft shift (title, times, capacity, location).',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseObjectSchema } }, description: 'Shift updated' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
        409: { description: 'Conflict — invalid state or capacity' }
    }
});

shiftsRouter.openapi(editShiftRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const result = await editShift(id, orgId, user.id, body);
    return jsonOk(c, result);
});

// =============================================================================
// UNASSIGN WORKER
// =============================================================================

const unassignWorkerRoute = createRoute({
    method: 'delete',
    path: '/{id}/assign/{workerId}',
    summary: 'Unassign Worker',
    description: 'Remove a worker from a shift. Cannot unassign if worker has already clocked in.',
    request: { params: z.object({ id: z.string(), workerId: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseObjectSchema } }, description: 'Worker unassigned' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
        409: { description: 'Conflict — worker already clocked in' }
    }
});

shiftsRouter.openapi(unassignWorkerRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const shiftId = c.req.param("id");
    const workerId = c.req.param("workerId");
    const orgId = c.get("orgId");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const result = await unassignWorker(shiftId, workerId, orgId, user.id);
    return jsonOk(c, result);
});

// =============================================================================
// DUPLICATE SHIFT
// =============================================================================

const duplicateShiftRoute = createRoute({
    method: 'post',
    path: '/{id}/duplicate',
    summary: 'Duplicate Shift',
    description: 'Copy a shift as a new draft with new start/end times.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseObjectSchema } }, description: 'Shift duplicated' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(duplicateShiftRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await duplicateShift(id, orgId, body);
    return jsonOk(c, result);
});

// =============================================================================
// OPEN / UNFILLED SHIFTS
// =============================================================================

const openShiftsRoute = createRoute({
    method: 'get',
    path: '/open',
    summary: 'Get Open Shifts',
    description: 'Get future shifts with unfilled capacity (spots remaining > 0).',
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseArraySchema } }, description: 'Open shifts' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(openShiftsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getOpenShifts(orgId);
    return jsonOk(c, result);
});
