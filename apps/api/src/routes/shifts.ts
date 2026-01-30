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

import { Hono } from "hono";
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
} from "@repo/shifts-service";

export const shiftsRouter = new Hono<AppContext>();

// =============================================================================
// DRAFT SHIFTS
// =============================================================================

shiftsRouter.get("/drafts", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    return await getDraftShifts(orgId);
});

shiftsRouter.delete("/drafts", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    return await deleteDraftsController(orgId);
});

// =============================================================================
// SHIFT LISTS
// =============================================================================

shiftsRouter.get("/upcoming", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    return await getUpcomingShifts(orgId);
});

shiftsRouter.get("/pending-approval", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    return await getPendingShifts(orgId);
});

shiftsRouter.get("/history", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "50"), 1), 100);
    const offset = Math.max(parseInt(c.req.query("offset") || "0"), 0);
    return await getHistoryShifts(orgId, { limit, offset });
});

// =============================================================================
// SHIFT GROUPS
// =============================================================================

shiftsRouter.get("/groups/:groupId", requireManager(), async (c) => {
    const groupId = c.req.param("groupId");
    const orgId = c.get("orgId");
    return await getShiftGroupController(groupId, orgId);
});

// =============================================================================
// SINGLE SHIFT OPERATIONS
// =============================================================================

shiftsRouter.get("/:id", async (c) => {
    const id = c.req.param("id");
    const orgId = c.get("orgId");
    return await getShiftByIdController(id, orgId);
});

shiftsRouter.post("/:id/approve", requireManager(), async (c) => {
    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return await approveShiftController(id, orgId, user.id);
});

shiftsRouter.post("/:id/cancel", requireManager(), async (c) => {
    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return await cancelShiftController(id, orgId, user.id);
});

shiftsRouter.post("/:id/assign", requireManager(), async (c) => {
    const id = c.req.param("id");
    const orgId = c.get("orgId");
    return await assignWorkerController(c.req.raw, id, orgId);
});

// =============================================================================
// SHIFT TIMESHEETS
// =============================================================================

shiftsRouter.get("/:id/timesheets", requireManager(), async (c) => {
    const id = c.req.param("id");
    const orgId = c.get("orgId");
    return await getShiftTimesheetsController(id, orgId);
});

shiftsRouter.patch("/:shiftId/timesheet", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    return await updateTimesheetController(c.req.raw, orgId);
});

// =============================================================================
// SCHEDULE PUBLISHING
// =============================================================================

shiftsRouter.post("/publish", requireManager(), rateLimit(RATE_LIMITS.publish), async (c) => {
    const orgId = c.get("orgId");
    return await publishScheduleController(c.req.raw, orgId);
});

export default shiftsRouter;
