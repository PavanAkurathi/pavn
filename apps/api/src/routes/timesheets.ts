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

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "../index";
import { type Context } from "hono";

// Import controllers
import {
    getTimesheetsReportController,
    getReportFiltersController,
    exportTimesheetsController,
    TimesheetReportSchema, // Schema
} from "@repo/shifts-service";

export const timesheetsRouter = new OpenAPIHono<AppContext>();

// =============================================================================
// TIMESHEET REPORTS
// =============================================================================

const getReportRoute = createRoute({
    method: 'get',
    path: '/',
    summary: 'Get Timesheet Report',
    description: 'Get aggregated timesheet report.',
    responses: {
        200: {
            content: { 'application/json': { schema: TimesheetReportSchema } },
            description: 'Timesheet report'
        },
        403: { description: 'Forbidden' }
    }
});

timesheetsRouter.openapi(getReportRoute, async (c: Context<AppContext>) => {
    const orgId = c.get("orgId");
    const queryParams = parseQueryParams(c.req.url);
    const result = await getTimesheetsReportController(orgId, queryParams);
    return c.json(result as any, 200);
});

const getFiltersRoute = createRoute({
    method: 'get',
    path: '/filters',
    summary: 'Get Report Filters',
    description: 'Get available filters for reports.',
    responses: {
        200: {
            content: { 'application/json': { schema: z.any() } },
            description: 'Filters'
        }
    }
});

timesheetsRouter.openapi(getFiltersRoute, async (c) => {
    const orgId = c.get("orgId");
    const queryParams = parseQueryParams(c.req.url);
    const result = await getReportFiltersController(orgId, queryParams);
    return c.json(result as any, 200);
});

// =============================================================================
// EXPORTS
// =============================================================================

const exportRoute = createRoute({
    method: 'get',
    path: '/export',
    summary: 'Export Timesheets',
    description: 'Export timesheets in specified format.',
    request: {
        query: z.object({
            format: z.string().optional()
        })
    },
    responses: {
        200: {
            description: 'File download',
            content: { 'application/octet-stream': { schema: z.string() } }
        }
    }
});

timesheetsRouter.openapi(exportRoute, async (c) => {
    const orgId = c.get("orgId");
    const queryParams = parseQueryParams(c.req.url);
    const result = await exportTimesheetsController(orgId, queryParams);
    return c.json(result as any, 200);
});

const exportCsvRoute = createRoute({
    method: 'get',
    path: '/export/csv',
    summary: 'Export as CSV',
    description: 'Export timesheets as CSV.',
    responses: {
        200: {
            description: 'CSV file',
            content: { 'text/csv': { schema: z.string() } }
        }
    }
});

timesheetsRouter.openapi(exportCsvRoute, async (c) => {
    const orgId = c.get("orgId");
    const queryParams = parseQueryParams(c.req.url);
    queryParams.format = "csv";
    const result = await exportTimesheetsController(orgId, queryParams);
    return c.json(result as any, 200);
});

const exportPdfRoute = createRoute({
    method: 'get',
    path: '/export/pdf',
    summary: 'Export as PDF',
    description: 'Export timesheets as PDF.',
    responses: {
        200: {
            description: 'PDF file',
            content: { 'application/pdf': { schema: z.string() } }
        }
    }
});

timesheetsRouter.openapi(exportPdfRoute, async (c) => {
    const orgId = c.get("orgId");
    const queryParams = parseQueryParams(c.req.url);
    queryParams.format = "pdf";
    const result = await exportTimesheetsController(orgId, queryParams);
    return c.json(result as any, 200);
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
    urlObj.searchParams.forEach((value: string, key: string) => {
        params[key] = value;
    });
    return params;
}

export default timesheetsRouter;
