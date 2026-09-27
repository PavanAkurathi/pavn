/**
 * @fileoverview Scheduler Routes
 * @module apps/api/routes/scheduler
 *
 * The manager's weekly Scheduler: a people-by-day grid for one location.
 * Handlers stay thin; the week is assembled in @repo/scheduling-timekeeping.
 */

import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { SchedulerWeekQuerySchema, SchedulerWeekSchema } from "@repo/contracts/scheduler";
import { getSchedulerWeek } from "@repo/scheduling-timekeeping";
import type { AppContext } from "../index";
import { requireManager } from "../middleware";
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
