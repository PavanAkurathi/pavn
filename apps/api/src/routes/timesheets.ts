/**
 * @fileoverview Timesheet Reports and Export Routes
 * @module apps/api/routes/timesheets
 * 
 * Provides timesheet reporting, filtering, and export functionality
 * for managers to review and export worker time records.
 * 
 * @description
 * This router handles all timesheet-related operations including:
 * - Viewing aggregated timesheet reports
 * - Filtering by date range, worker, location
 * - Exporting to CSV and PDF formats
 * 
 * All endpoints require manager role or above.
 * 
 * Endpoints:
 * - GET / - Get timesheet report with filters
 * - GET /filters - Get available filter options
 * - GET /export - Export timesheets (format via query param)
 * - GET /export/csv - Export as CSV
 * - GET /export/pdf - Export as PDF
 * 
 * Query Parameters (all endpoints):
 * - from: Start date (ISO string)
 * - to: End date (ISO string)
 * - workerId: Filter by worker
 * - locationId: Filter by location
 * - status: approved | pending | flagged
 * 
 * @requires @repo/shifts - Timesheet report controllers
 * @author WorkersHive Team
 * @since 1.0.0
 */

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

/**
 * Parse URL query parameters into a key-value object.
 * @param url - The full URL string
 * @returns Object with query parameter key-value pairs
 */
function parseQueryParams(url: string): Record<string, string> {
    const params: Record<string, string> = {};
    const urlObj = new URL(url);
    urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
    });
    return params;
}

export default timesheetsRouter;
