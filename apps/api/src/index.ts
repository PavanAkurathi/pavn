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
 * - GET /ready - Launch readiness check
 * - POST/GET /api/auth/* - Better Auth handlers
 * 
 * Protected Routes (require auth + org context):
 * - /shifts/* - Shift management
 * - /worker/* - Worker-facing endpoints
 * - /timesheets/* - Timesheet reports
 * - /billing/* - Billing overview and read access
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
 * curl http://localhost:4005/ready
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
import { corsConfig } from "@repo/config";
import { getOrganizationMembershipContext } from "@repo/organizations";
import { initSentry, logMessage } from "@repo/observability";

// Import route modules
// Import route modules
import { shiftsRouter } from "./routes/shifts.js";
import { workerRouter } from "./routes/worker.js";
import { timesheetsRouter } from "./routes/timesheets.js";
import { billingRouter } from "./routes/billing.js";
import { organizationsRouter } from "./routes/organizations.js";
import { geofenceRouter } from "./routes/geofence.js";
import { getApiReadinessSummary, validateApiRuntimeEnv } from "./lib/runtime-env.js";
import { errorHandler } from "./lib/error-handler.js";
import { requestId, timeout, rateLimit, RATE_LIMITS } from "./middleware/index.js";
import { normalizeOrganizationRole, type Role } from "./lib/organization-roles.js";

// Types
// Extend session type to include Better-Auth organization plugin fields
type SessionWithOrg = typeof auth.$Infer.Session.session & {
    activeOrganizationId?: string | null;
};

export type AppContext = {
    Variables: {
        requestId: string;
        orgId: string;
        user: typeof auth.$Infer.Session.user | null;
        session: SessionWithOrg | null;
        userRole: Role | null;
    };
};

// Create main app
initSentry();
validateApiRuntimeEnv();

const app = new OpenAPIHono<AppContext>();

// =============================================================================
// OPENAPI & SWAGGER
// =============================================================================

const openApiDocument = {
    openapi: "3.0.0",
    info: {
        version: "1.0.0",
        title: "WorkersHive API",
        description: "API for managing shifts, workers, and organizations.",
    },
    paths: {
        "/health": {
            get: {
                summary: "Health check",
                responses: {
                    "200": {
                        description: "Service is healthy",
                    },
                },
            },
        },
        "/ready": {
            get: {
                summary: "Readiness check",
                responses: {
                    "200": {
                        description: "Service is ready",
                    },
                    "503": {
                        description: "Service is not ready",
                    },
                },
            },
        },
    },
};

app.get("/openapi.json", (c) => c.json(openApiDocument));

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// Root route to prevent 404s
app.get("/", (c) => c.text("WorkersHive API 🚀"));

// =============================================================================
// GLOBAL MIDDLEWARE
// =============================================================================

// CORS
app.use("*", cors(corsConfig));

// Request tracing, timeout & global rate limit
app.use("*", requestId());
app.use("*", timeout(30000));
// Global rate limit — catches broad abuse; route-specific limits are tighter
app.use("/shifts/*", rateLimit(RATE_LIMITS.api));
app.use("/worker/*", rateLimit(RATE_LIMITS.api));
app.use("/timesheets/*", rateLimit(RATE_LIMITS.api));
app.use("/organizations/*", rateLimit(RATE_LIMITS.api));
app.use("/billing/*", rateLimit(RATE_LIMITS.api));
app.use("/api/auth/*", rateLimit(RATE_LIMITS.auth));
app.use("*", async (c, next) => {
    await next();

    const status = c.res.status;
    if (status >= 500 || (c.req.path === "/ready" && status === 503)) {
        logMessage("[API] Request requires attention", {
            path: c.req.path,
            method: c.req.method,
            status,
            requestId: c.get("requestId"),
        });
    }
});

// Global error handler
app.onError((err, c) => errorHandler(err, c));

// =============================================================================
// PUBLIC ROUTES (No auth required)
// =============================================================================

// Health check
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));
app.get("/ready", async (c) => {
    const readiness = await getApiReadinessSummary();
    return c.json(readiness, readiness.status === "ready" ? 200 : 503);
});

void (async () => {
    const readiness = await getApiReadinessSummary();
    logMessage(
        readiness.status === "ready"
            ? "[READY] API startup ready"
            : "[READY] API startup not ready",
        {
            status: readiness.status,
            required: readiness.required,
            optional: readiness.optional,
        }
    );
})();

// Geo-restrict all signup/verification paths to US and Canada
const GEO_RESTRICTED_AUTH_PATHS = [
    "/api/auth/sign-up/email",          // Admin email signup
    "/api/auth/phone-number/send-otp",  // Worker phone OTP (triggers auto-signup)
    "/api/auth/phone-number/verify",    // Phone verification (creates account via signUpOnVerification)
    "/api/auth/email-otp/send-verification-otp", // Email OTP flow
];
const ALLOWED_COUNTRIES = ["US", "CA"];

app.use("/api/auth/*", async (c, next) => {
    if (c.req.method === "POST" && GEO_RESTRICTED_AUTH_PATHS.includes(c.req.path)) {
        const country = c.req.header("x-vercel-ip-country") || c.req.header("cf-ipcountry");

        if (country && !ALLOWED_COUNTRIES.includes(country)) {
            return c.json(
                { message: "Registration is currently limited to the US and Canada." },
                403
            );
        }
    }

    await next();
});

// Auth routes (Better Auth handles these)
app.on(["POST", "GET", "PATCH", "PUT", "DELETE"], "/api/auth/*", async (c) => {
    try {
        return await auth.handler(c.req.raw);
    } catch (error) {
        logMessage("[AUTH ERROR] Auth handler exception", { path: c.req.path, method: c.req.method });
        return c.json({ error: "Internal Auth Error" }, 500);
    }
});

// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================

const authContextPromise = (auth as any).$context as Promise<{
    internalAdapter: {
        findSession: (token: string) => Promise<{
            session: typeof auth.$Infer.Session.session;
            user: typeof auth.$Infer.Session.user;
        } | null>;
        deleteSession: (token: string) => Promise<void>;
    };
}>;

async function getBearerSession(sourceHeaders: Headers) {
    const authorization = sourceHeaders.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
        return null;
    }

    const token = authorization.slice("Bearer ".length).trim();
    if (!token) {
        return null;
    }

    const authContext = await authContextPromise;
    const session = await authContext.internalAdapter.findSession(token);
    if (!session) {
        return null;
    }

    if (session.session.expiresAt < new Date()) {
        await authContext.internalAdapter.deleteSession(session.session.token);
        return null;
    }

    return session;
}

async function resolveRequestSession(sourceHeaders: Headers) {
    const cookieSession = await auth.api.getSession({
        headers: sourceHeaders,
    });
    if (cookieSession) {
        return cookieSession;
    }

    return getBearerSession(sourceHeaders);
}

app.use("*", async (c, next) => {
    // Skip public routes
    if (
        c.req.path === "/health" ||
        c.req.path === "/ready" ||
        c.req.path.startsWith("/api/auth") ||
        c.req.path === "/billing/webhooks/stripe" ||
        c.req.path.startsWith("/worker/auth") ||
        c.req.path === "/docs" ||
        c.req.path === "/openapi.json" ||
        c.req.path === "/"
    ) {
        await next();
        return;
    }

    // Validate session
    const session = await resolveRequestSession(c.req.raw.headers);
    if (!session) {
        return c.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, 401);
    }

    c.set("user", session.user);
    c.set("session", session.session);

    // Validate tenant context
    // Some worker routes are cross-org (no x-org-id needed)
    const ORG_FREE_PREFIXES = [
        '/worker/all-shifts',
        '/worker/organizations',
        '/devices',
        '/organizations/invitations',
        '/organizations/default',
    ];
    const isOrgFree = ORG_FREE_PREFIXES.some(prefix => c.req.path.startsWith(prefix));

    if (isOrgFree) {
        // Cross-org route: authenticated by session only, no org context
        c.set("orgId", "");
        c.set("userRole", "member" as Role);
        await next();
        return;
    }

    const orgId = c.req.header("x-org-id");
    if (!orgId) {
        return c.json({ error: "Missing organization context", code: "ORG_REQUIRED" }, 401);
    }

    const memberRecord = await getOrganizationMembershipContext(session.user.id, orgId);

    if (!memberRecord) {
        return c.json({ error: "Not a member of this organization", code: "ACCESS_DENIED" }, 403);
    }

    c.set("orgId", orgId);
    c.set("userRole", normalizeOrganizationRole(memberRecord.role));

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
import { notificationsRouter } from "./routes/notifications.js";

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
app.route("/notifications", notificationsRouter);

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
