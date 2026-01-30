// apps/api/src/routes/timesheets.ts
// Timesheet Management Routes

import { Hono } from "hono";
import type { AppContext } from "../index";
import { requireManager } from "../middleware";

// Import controllers
import {
    getTimesheetsReportController,
    getReportFiltersController,
    exportTimesheetsController,
} from "@repo/shifts";

export const timesheetsRouter = new Hono<AppContext>();

// =============================================================================
// TIMESHEET REPORTS
// =============================================================================

timesheetsRouter.get("/", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    const queryParams = parseQueryParams(c.req.url);
    return await getTimesheetsReportController(orgId, queryParams);
});

timesheetsRouter.get("/filters", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    const queryParams = parseQueryParams(c.req.url);
    return await getReportFiltersController(orgId, queryParams);
});

// =============================================================================
// EXPORTS
// =============================================================================

timesheetsRouter.get("/export", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    const queryParams = parseQueryParams(c.req.url);
    return await exportTimesheetsController(orgId, queryParams);
});

timesheetsRouter.get("/export/csv", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    const queryParams = parseQueryParams(c.req.url);
    queryParams.format = "csv";
    return await exportTimesheetsController(orgId, queryParams);
});

timesheetsRouter.get("/export/pdf", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    const queryParams = parseQueryParams(c.req.url);
    queryParams.format = "pdf";
    return await exportTimesheetsController(orgId, queryParams);
});

// =============================================================================
// HELPERS
// =============================================================================

function parseQueryParams(url: string): Record<string, string> {
    const params: Record<string, string> = {};
    const urlObj = new URL(url);
    urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
    });
    return params;
}

export default timesheetsRouter;
