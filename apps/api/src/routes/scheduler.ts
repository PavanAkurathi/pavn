/**
 * @fileoverview Scheduler Routes
 * @module apps/api/routes/scheduler
 *
 * The manager's weekly Scheduler: a people-by-day grid for one location.
 * Handlers stay thin; the week is assembled in @repo/scheduling-timekeeping.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
    SchedulerPublishInputSchema,
    SchedulerPublishPreviewSchema,
    SchedulerPublishResultSchema,
    SchedulerChangesInputSchema,
    SchedulerChangesResultSchema,
    SchedulerDiscardResultSchema,
    SchedulerTemplateSchema,
    SchedulerWeekScopeSchema,
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
    DecideRequestInputSchema,
    DecideRequestResultSchema,
    ManagerRequestsQuerySchema,
    ManagerRequestsResponseSchema,
    RequestIdParamSchema,
    RequestsSummarySchema,
} from "@repo/contracts/requests";
import {
    decideRequest,
    getRequestsSummary,
    listManagerRequests,
    previewSchedulerPublish,
    publishSchedulerWeek,
    applySchedulerChanges,
    discardSchedulerWeek,
    listShiftTemplates,
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

const json = <T extends z.ZodTypeAny>(schema: T) => ({ content: { "application/json": { schema } } });

// =============================================================================
// Editing: one endpoint for every grid action, so each is atomic and undoable.
// =============================================================================

const changesRoute = createRoute({
    method: "post",
    path: "/changes",
    summary: "Apply Scheduler changes",
    description:
        "Create, update, delete and assign shifts in one transaction. New shifts are drafts; changes to published " +
        "shifts are staged until the week is published. Answers with the changes that undo the batch. Putting someone " +
        "where they are double-booked or on approved time off is a 409 unless `force` is set, which is audited.",
    request: { body: { ...json(SchedulerChangesInputSchema), required: true } },
    responses: {
        200: { ...json(SchedulerChangesResultSchema), description: "Applied" },
        400: { description: "Invalid change" },
        403: { description: "Managers only" },
        404: { description: "Shift, person, location or event not found in this organization" },
        409: { description: "Blocking conflict, capacity, or a shift that has already started" },
    },
});

schedulerRouter.openapi(changesRoute, async (c) => {
    const result = await applySchedulerChanges({ orgId: c.get("orgId"), actorId: c.get("user")?.id ?? "unknown", body: c.req.valid("json") });
    return jsonOk(c, result);
});

const discardRoute = createRoute({
    method: "post",
    path: "/week/discard",
    summary: "Discard unpublished changes for one week at one location",
    request: { body: { ...json(SchedulerWeekScopeSchema), required: true } },
    responses: {
        200: { ...json(SchedulerDiscardResultSchema), description: "What was thrown away" },
        403: { description: "Managers only" },
        404: { description: "Location not found" },
    },
});

schedulerRouter.openapi(discardRoute, async (c) => {
    return jsonOk(c, await discardSchedulerWeek({ orgId: c.get("orgId"), body: c.req.valid("json") }));
});

const publishPreviewRoute = createRoute({
    method: "get",
    path: "/week/publish-preview",
    summary: "What publishing this week would do",
    description: "New, changed and removed shifts; who gets a message; who can't be reached; open spots; conflicts left.",
    request: { query: SchedulerWeekScopeSchema },
    responses: {
        200: { ...json(SchedulerPublishPreviewSchema), description: "Preview" },
        403: { description: "Managers only" },
        404: { description: "Location not found" },
    },
});

schedulerRouter.openapi(publishPreviewRoute, async (c) => {
    return jsonOk(c, await previewSchedulerPublish({ orgId: c.get("orgId"), body: c.req.valid("query") }));
});

const publishRoute = createRoute({
    method: "post",
    path: "/week/publish",
    summary: "Publish one week at one location",
    description:
        "Drafts go live, staged edits and people changes apply, staged removals cancel, and each affected person gets " +
        "one message. A 409 lists anyone still double-booked or on approved time off unless `force` is set (audited).",
    request: { body: { ...json(SchedulerPublishInputSchema), required: true } },
    responses: {
        200: { ...json(SchedulerPublishResultSchema), description: "Published" },
        403: { description: "Managers only" },
        404: { description: "Location not found" },
        409: { description: "Unresolved conflicts" },
    },
});

schedulerRouter.openapi(publishRoute, async (c) => {
    const result = await publishSchedulerWeek({ orgId: c.get("orgId"), actorId: c.get("user")?.id ?? "unknown", body: c.req.valid("json") });
    return jsonOk(c, result);
});

const templatesRoute = createRoute({
    method: "get",
    path: "/templates",
    summary: "Shift templates for a location",
    request: { query: z.object({ locationId: z.string().min(1) }) },
    responses: {
        200: { ...json(z.array(SchedulerTemplateSchema)), description: "Templates" },
        403: { description: "Managers only" },
    },
});

schedulerRouter.openapi(templatesRoute, async (c) => {
    const { locationId } = c.req.valid("query");
    const templates = await listShiftTemplates(c.get("orgId"));
    return jsonOk(
        c,
        templates
            .filter((t) => t.locationId === locationId)
            .map(({ id, name, locationId: loc, startTime, endTime, positions, headcount }) => ({
                id, name, locationId: loc, startTime, endTime, positions, headcount,
            })),
    );
});

// =============================================================================
// Setup and settings. Managers read them; changing them is for admins.
// =============================================================================

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

// =============================================================================
// REQUESTS (claims, drops, swaps, time off)
// =============================================================================

const listRequestsRoute = createRoute({
    method: "get",
    path: "/requests",
    summary: "Requests waiting on a manager",
    description:
        "Claims, drops, swaps a coworker already accepted, and time off, newest first, each with what approving " +
        "would do and anything that needs \"approve anyway\". `view=recent` lists the last two weeks' decisions instead.",
    request: { query: ManagerRequestsQuerySchema },
    responses: {
        200: { ...json(ManagerRequestsResponseSchema), description: "Requests" },
        403: { description: "Managers only" },
    },
});

schedulerRouter.openapi(listRequestsRoute, async (c) => {
    return jsonOk(c, await listManagerRequests({ orgId: c.get("orgId"), query: c.req.valid("query") }));
});

const requestsSummaryRoute = createRoute({
    method: "get",
    path: "/requests/summary",
    summary: "How many requests are waiting",
    responses: {
        200: { ...json(RequestsSummarySchema), description: "Count" },
        403: { description: "Managers only" },
    },
});

schedulerRouter.openapi(requestsSummaryRoute, async (c) => {
    return jsonOk(c, await getRequestsSummary({ orgId: c.get("orgId") }));
});

const decisionRoute = (decision: "approve" | "decline") =>
    createRoute({
        method: "post",
        path: `/requests/{id}/${decision}`,
        summary: decision === "approve" ? "Approve a request" : "Decline a request",
        description:
            decision === "approve"
                ? "Applies it now: the person is put on or taken off the shift, or the time off is granted, and they're told. " +
                  "A 409 names a double-booking or time off unless `force` is set (audited)."
                : "Nothing changes on the schedule; the person is told, with the note if there is one.",
        request: { params: RequestIdParamSchema, body: { ...json(DecideRequestInputSchema), required: true } },
        responses: {
            200: { ...json(DecideRequestResultSchema), description: "Decided" },
            403: { description: "Managers only" },
            404: { description: "Request not found" },
            409: { description: "Already decided, shift started or full, or a conflict" },
        },
    });

for (const decision of ["approve", "decline"] as const) {
    schedulerRouter.openapi(decisionRoute(decision), async (c) => {
        const { id } = c.req.valid("param");
        return jsonOk(
            c,
            await decideRequest({ orgId: c.get("orgId"), actorId: c.get("user")?.id ?? "unknown", id, decision, body: c.req.valid("json") }),
        );
    });
}
