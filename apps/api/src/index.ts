/**
 * @fileoverview WorkersHive API Server - Main Entry Point
 * @module apps/api
 * 
 * Centralized Hono-based REST API server for the WorkersHive staffing platform.
 * Handles all backend routes for shift management, timesheets, geofencing,
 * billing, and organization management.
 * 
 * @description
 * This is the single entry point for all backend API routes. It consolidates
 * what was previously spread across multiple packages into a unified server.
 * 
 * Architecture:
 * - Global middleware: CORS, auth, request tracing, error handling
 * - Modular routes: Each domain has its own router module
 * - RBAC: Role-based access control at route level
 * - Multi-tenant: Organization context via x-org-id header
 * 
 * Public Routes (no auth):
 * - GET /health - Health check
 * - POST/GET /api/auth/* - Better Auth handlers
 * 
 * Protected Routes (require auth + org context):
 * - /shifts/* - Shift management
 * - /worker/* - Worker-facing endpoints
 * - /timesheets/* - Timesheet reports
 * - /billing/* - Billing & payments
 * - /organizations/* - Crew & locations
 * - /geofence/* - Clock in/out
 * 
 * @requires hono
 * @requires @repo/auth - Better Auth configuration
 * @requires @repo/database - Drizzle ORM + PostgreSQL
 * @requires @repo/config - CORS and environment config
 * @requires @repo/observability - Sentry, logging, request tracing
 * 
 * @example
 * // Start the server
 * bun run src/index.ts
 * 
 * // Health check
 * curl http://localhost:4005/health
 * 
 * @author WorkersHive Team
 * @since 1.0.0
 * @version 1.0.0
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { auth } from "@repo/auth";
import { db, eq, and } from "@repo/database";
import { member } from "@repo/database/schema";
import { corsConfig } from "@repo/config";
import { requestId, errorHandler, timeout } from "@repo/observability";

// Import route modules
// Import route modules
import { shiftsRouter } from "./routes/shifts.js";
import { workerRouter } from "./routes/worker.js";
import { timesheetsRouter } from "./routes/timesheets.js";
import { billingRouter } from "./routes/billing.js";
import { organizationsRouter } from "./routes/organizations.js";
import { geofenceRouter } from "./routes/geofence.js";

// Types
export type Role = "owner" | "admin" | "manager" | "member";

export type AppContext = {
    Variables: {
        orgId: string;
        user: typeof auth.$Infer.Session.user | null;
        session: typeof auth.$Infer.Session.session | null;
        userRole: Role | null;
    };
};

// Create main app
const app = new OpenAPIHono<AppContext>();

// =============================================================================
// OPENAPI & SWAGGER
// =============================================================================

app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
        version: "1.0.0",
        title: "WorkersHive API",
        description: "API for managing shifts, workers, and organizations.",
    },
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// Root route to prevent 404s
app.get("/", (c) => c.text("WorkersHive API 🚀"));

// =============================================================================
// GLOBAL MIDDLEWARE
// =============================================================================

// CORS
app.use("*", cors(corsConfig));

// Request tracing & timeout
app.use("*", requestId());
app.use("*", timeout(30000));

// Global error handler
app.onError((err, c) => errorHandler(err, c));

// =============================================================================
// PUBLIC ROUTES (No auth required)
// =============================================================================

// Health check
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Auth routes (Better Auth handles these)
app.on(["POST", "GET"], "/api/auth/*", (c) => {
    return auth.handler(c.req.raw);
});

// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================

app.use("*", async (c, next) => {
    // Skip public routes
    if (c.req.path === "/health" || c.req.path.startsWith("/api/auth") || c.req.path === "/docs" || c.req.path === "/openapi.json" || c.req.path === "/") {
        await next();
        return;
    }

    // Validate session
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
        return c.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, 401);
    }

    c.set("user", session.user);
    c.set("session", session.session);

    // Validate tenant context
    const orgId = c.req.header("x-org-id");
    if (!orgId) {
        return c.json({ error: "Missing organization context", code: "ORG_REQUIRED" }, 401);
    }

    // Verify membership and get role
    const memberRecord = await db.query.member.findFirst({
        where: and(
            eq(member.organizationId, orgId),
            eq(member.userId, session.user.id)
        ),
        columns: { id: true, role: true }
    });

    if (!memberRecord) {
        return c.json({ error: "Not a member of this organization", code: "ACCESS_DENIED" }, 403);
    }

    c.set("orgId", orgId);
    c.set("userRole", memberRecord.role as Role);

    await next();
});

// =============================================================================
// MOUNT ROUTE MODULES
// =============================================================================

import { requireManager } from "./middleware/index.js";

// Route mounting
import { devicesRouter } from "./routes/devices.js";
import { preferencesRouter } from "./routes/preferences.js";
import { managerPreferencesRouter } from "./routes/manager-preferences.js";

app.route("/shifts", shiftsRouter);
app.route("/worker", workerRouter);
app.use("/timesheets/*", requireManager());
app.route("/timesheets", timesheetsRouter);
app.route("/billing", billingRouter);
app.route("/organizations", organizationsRouter);
app.route("/geofence", geofenceRouter);
app.route("/devices", devicesRouter);
app.route("/preferences", preferencesRouter);
app.route("/manager-preferences", managerPreferencesRouter);

// Legacy routes for backwards compatibility
app.route("/schedules", shiftsRouter);
app.route("/locations", organizationsRouter);
app.route("/adjustments", geofenceRouter);

// =============================================================================
// 404 Handler
// =============================================================================

app.notFound((c) => {
    return c.json({ error: "Not found", code: "NOT_FOUND", path: c.req.path }, 404);
});

// =============================================================================
// START SERVER
// =============================================================================

const port = process.env.PORT || 4005;
const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${port}`;
console.log(`🚀 WorkersHive API running at ${baseUrl}`);

export default {
    port,
    fetch: app.fetch,
} as { port: number | string; fetch: typeof app.fetch };

export { app };

// Vercel Serverless/Edge Exports
import { handle } from 'hono/vercel';
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
export const HEAD = handle(app);
