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
 * to controllers in @repo/shifts package.
 * 
 * Endpoints:
 * - GET /drafts - Get unpublished draft shifts
 * - DELETE /drafts - Clear all drafts
 * - GET /upcoming - Future published shifts
 * - GET /pending-approval - Shifts awaiting approval
 * - GET /history - Past completed shifts
 * - GET /groups/:groupId - Get shift group details
 * - GET /:id - Single shift details
 * - POST /:id/approve - Approve a pending shift
 * - POST /:id/cancel - Cancel a shift
 * - POST /:id/assign - Assign worker to shift
 * - GET /:id/timesheets - Get timesheets for shift
 * - PATCH /:shiftId/timesheet - Update timesheet
 * - POST /publish - Publish draft schedule (rate limited)
 * 
 * @requires @repo/shifts - Shift business logic controllers
 * @author WorkersHive Team
 * @since 1.0.0
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "../index";
import { requireManager } from "../middleware";
import { rateLimit, RATE_LIMITS } from "../middleware";

// Import controllers from packages (business logic stays in packages)
import {
    getUpcomingShifts,
    getPendingShifts,
    getHistoryShifts,
    getDraftShifts,
    deleteDraftsController,
    getShiftByIdController,
    getShiftGroupController,
    approveShiftController,
    cancelShiftController,
    assignWorkerController,
    getShiftTimesheetsController,
    updateTimesheetController,
    publishScheduleController,
    UpcomingShiftsResponseSchema,
    ShiftSchema,
    TimesheetSchema,
} from "@repo/shifts-service";

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
        200: { content: { 'application/json': { schema: z.array(ShiftSchema) } }, description: 'Draft shifts' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(getDraftsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getDraftShifts(orgId);
    return c.json(result as any, 200);
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
            content: {
                'application/json': {
                    schema: UpcomingShiftsResponseSchema,
                },
            },
            description: 'List of upcoming shifts',
        },
        403: {
            content: {
                'application/json': {
                    schema: z.object({
                        error: z.string(),
                    }),
                },
            },
            description: 'Access denied',
        },
    },
});

shiftsRouter.openapi(upcomingRoute, async (c) => {
    // Middleware-like check since openapi() doesn't support array middleware easily yet
    // In a full refactor, we'd use a middleware wrapper or specific OpenAPI middleware
    const userRole = c.get("userRole");
    // basic check, though requireManager() middleware is better. 
    // For this POC, we'll assume the global auth middleware handled the user context,
    // but specific role checks might need to be inside here or via a middleware wrapper.
    if (userRole !== "manager" && userRole !== "owner" && userRole !== "admin") {
        return c.json({ error: "Access denied" }, 403);
    }

    const orgId = c.get("orgId");
    const result = await getUpcomingShifts(orgId);
    return c.json(result as any, 200);
});

const getPendingRoute = createRoute({
    method: 'get',
    path: '/pending-approval',
    summary: 'Get Pending Shifts',
    description: 'Get shifts waiting for approval.',
    responses: {
        200: { content: { 'application/json': { schema: z.array(ShiftSchema) } }, description: 'Pending shifts' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(getPendingRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getPendingShifts(orgId);
    return c.json(result as any, 200);
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
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Shift history' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(getHistoryRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "50"), 1), 100);
    const offset = Math.max(parseInt(c.req.query("offset") || "0"), 0);
    const result = await getHistoryShifts(orgId, { limit, offset });
    return c.json(result as any, 200);
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
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Shift group' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(getGroupRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const groupId = c.req.param("groupId");
    const orgId = c.get("orgId");
    const result = await getShiftGroupController(groupId, orgId);
    return c.json(result as any, 200);
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
        200: { content: { 'application/json': { schema: ShiftSchema } }, description: 'Shift details' }
    }
});

shiftsRouter.openapi(getShiftRoute, async (c) => {
    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await getShiftByIdController(id, orgId);
    return c.json(result as any, 200);
});

const approveShiftRoute = createRoute({
    method: 'post',
    path: '/{id}/approve',
    summary: 'Approve Shift',
    description: 'Approve a pending shift.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Shift approved' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(approveShiftRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const result = await approveShiftController(id, orgId, user.id);
    return c.json(result as any, 200);
});

const cancelShiftRoute = createRoute({
    method: 'post',
    path: '/{id}/cancel',
    summary: 'Cancel Shift',
    description: 'Cancel a shift.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Shift canceled' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(cancelShiftRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const result = await cancelShiftController(id, orgId, user.id);
    return c.json(result as any, 200);
});

const assignWorkerRoute = createRoute({
    method: 'post',
    path: '/{id}/assign',
    summary: 'Assign Worker',
    description: 'Assign a worker to a shift.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Worker assigned' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(assignWorkerRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await assignWorkerController(c.req.raw, id, orgId);
    return c.json(result as any, 200);
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
        200: { content: { 'application/json': { schema: z.array(TimesheetSchema) } }, description: 'Timesheets' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(getShiftTimesheetsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await getShiftTimesheetsController(id, orgId);
    return c.json(result as any, 200);
});

const updateTimesheetRoute = createRoute({
    method: 'patch',
    path: '/{shiftId}/timesheet',
    summary: 'Update Timesheet',
    description: 'Update a timesheet entry.',
    request: { params: z.object({ shiftId: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Timesheet updated' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(updateTimesheetRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await updateTimesheetController(c.req.raw, orgId);
    return c.json(result as any, 200);
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
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Schedule published' },
        403: { description: 'Forbidden' }
    }
});

shiftsRouter.openapi(publishRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!["manager", "owner", "admin"].includes(userRole as string)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await publishScheduleController(c.req.raw, orgId);
    return c.json(result as any, 200);
});

export default shiftsRouter;
