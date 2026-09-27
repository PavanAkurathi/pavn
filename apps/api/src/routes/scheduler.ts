/**
 * @fileoverview Scheduler Routes
 * @module apps/api/routes/scheduler
 *
 * The manager's weekly Scheduler: a people-by-day grid for one location.
 * Handlers stay thin; the week is assembled in @repo/scheduling-timekeeping.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
    DepartmentIdParamSchema,
    DepartmentInputSchema,
    DepartmentUpdateSchema,
    SchedulerWeekQuerySchema,
    SchedulerWeekSchema,
    SchedulingDepartmentSchema,
    SchedulingSettingsSchema,
    SchedulingSetupInputSchema,
    UpdateSchedulingSettingsSchema,
} from "@repo/contracts/scheduler";
import {
    applySchedulingSetup,
    createDepartment,
    deleteDepartment,
    getSchedulerWeek,
    getSchedulingSettings,
    listDepartments,
    updateDepartment,
    updateSchedulingSettings,
} from "@repo/scheduling-timekeeping";
import type { AppContext } from "../index";
import { requireAdmin, requireManager } from "../middleware";
import { jsonOk } from "../lib/response.js";

export const schedulerRouter = new OpenAPIHono<AppContext>();

// Every scheduler endpoint is for managers; the router protects itself so a
// new mount point can never expose it by accident.
schedulerRouter.use("*", requireManager());

const getWeekRoute = createRoute({
    method: "get",
    path: "/week",
    summary: "Get a Scheduler week",
    description:
        "Everything the weekly grid draws for one location: people, shifts (as the manager's working copy), " +
        "time off, events, hours and overtime, and conflict warnings. Times are the location's wall clock.",
    request: {
        query: SchedulerWeekQuerySchema,
    },
    responses: {
        200: { content: { "application/json": { schema: SchedulerWeekSchema } }, description: "The week" },
        400: { description: "weekStart is not a valid date" },
        403: { description: "Managers only" },
        404: { description: "Location not found in this organization" },
    },
});

schedulerRouter.openapi(getWeekRoute, async (c) => {
    const { locationId, weekStart } = c.req.valid("query");
    const week = await getSchedulerWeek({ orgId: c.get("orgId"), locationId, weekStart });
    return jsonOk(c, week);
});

// =============================================================================
// Setup and settings. Managers read them; changing them is for admins.
// =============================================================================

const json = <T extends z.ZodTypeAny>(schema: T) => ({ content: { "application/json": { schema } } });

const getSettingsRoute = createRoute({
    method: "get",
    path: "/settings",
    summary: "Get scheduling settings",
    description: "The onboarding answers, week start, overtime rule, approval policies and departments.",
    responses: {
        200: { ...json(SchedulingSettingsSchema), description: "Scheduling settings" },
        403: { description: "Managers only" },
    },
});

schedulerRouter.openapi(getSettingsRoute, async (c) => {
    return jsonOk(c, await getSchedulingSettings(c.get("orgId")));
});

const updateSettingsRoute = createRoute({
    method: "patch",
    path: "/settings",
    summary: "Update scheduling settings",
    middleware: [requireAdmin()] as const,
    request: { body: { ...json(UpdateSchedulingSettingsSchema), required: true } },
    responses: {
        200: { ...json(SchedulingSettingsSchema), description: "Updated settings" },
        400: { description: "Invalid setting" },
        403: { description: "Admins only" },
    },
});

schedulerRouter.openapi(updateSettingsRoute, async (c) => {
    return jsonOk(c, await updateSchedulingSettings(c.get("orgId"), c.req.valid("json")));
});

const setupRoute = createRoute({
    method: "post",
    path: "/setup",
    summary: "Answer the scheduling setup questions",
    description:
        "Saves business type, schedule style and open-shift claim policy. Seeds starter departments " +
        "for the business type only while the organization has none, so edits are never overwritten.",
    middleware: [requireAdmin()] as const,
    request: { body: { ...json(SchedulingSetupInputSchema), required: true } },
    responses: {
        200: { ...json(SchedulingSettingsSchema), description: "Settings after setup" },
        400: { description: "Invalid answer" },
        403: { description: "Admins only" },
    },
});

schedulerRouter.openapi(setupRoute, async (c) => {
    return jsonOk(c, await applySchedulingSetup(c.get("orgId"), c.req.valid("json")));
});

const listDepartmentsRoute = createRoute({
    method: "get",
    path: "/departments",
    summary: "List departments",
    responses: {
        200: { ...json(z.array(SchedulingDepartmentSchema)), description: "Departments in display order" },
        403: { description: "Managers only" },
    },
});

schedulerRouter.openapi(listDepartmentsRoute, async (c) => {
    return jsonOk(c, await listDepartments(c.get("orgId")));
});

const createDepartmentRoute = createRoute({
    method: "post",
    path: "/departments",
    summary: "Create a department",
    middleware: [requireAdmin()] as const,
    request: { body: { ...json(DepartmentInputSchema), required: true } },
    responses: {
        200: { ...json(SchedulingDepartmentSchema), description: "Created" },
        400: { description: "Invalid department" },
        403: { description: "Admins only" },
        409: { description: "A department with that name exists" },
    },
});

schedulerRouter.openapi(createDepartmentRoute, async (c) => {
    return jsonOk(c, await createDepartment(c.get("orgId"), c.req.valid("json")));
});

const updateDepartmentRoute = createRoute({
    method: "patch",
    path: "/departments/{id}",
    summary: "Rename, re-role or reorder a department",
    middleware: [requireAdmin()] as const,
    request: { params: DepartmentIdParamSchema, body: { ...json(DepartmentUpdateSchema), required: true } },
    responses: {
        200: { ...json(SchedulingDepartmentSchema), description: "Updated" },
        400: { description: "Invalid change" },
        403: { description: "Admins only" },
        404: { description: "Department not found" },
        409: { description: "A department with that name exists" },
    },
});

schedulerRouter.openapi(updateDepartmentRoute, async (c) => {
    const { id } = c.req.valid("param");
    return jsonOk(c, await updateDepartment(c.get("orgId"), id, c.req.valid("json")));
});

const deleteDepartmentRoute = createRoute({
    method: "delete",
    path: "/departments/{id}",
    summary: "Delete a department",
    description: "People are placed by their roles, so nobody is deleted with it; they move to another department or none.",
    middleware: [requireAdmin()] as const,
    request: { params: DepartmentIdParamSchema },
    responses: {
        200: { ...json(z.object({ id: z.string() })), description: "Deleted" },
        403: { description: "Admins only" },
        404: { description: "Department not found" },
    },
});

schedulerRouter.openapi(deleteDepartmentRoute, async (c) => {
    const { id } = c.req.valid("param");
    return jsonOk(c, await deleteDepartment(c.get("orgId"), id));
});
