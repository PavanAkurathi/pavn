// apps/api/src/index.ts
// Centralized API Server - Single entry point for all backend routes

import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "@repo/auth";
import { db } from "@repo/database";
import { member } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { corsConfig } from "@repo/config";
import { requestId, errorHandler, timeout } from "@repo/observability";

// Import route modules
import { shiftsRouter } from "./routes/shifts";
import { workerRouter } from "./routes/worker";
import { timesheetsRouter } from "./routes/timesheets";
import { billingRouter } from "./routes/billing";
import { organizationsRouter } from "./routes/organizations";
import { geofenceRouter } from "./routes/geofence";

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
const app = new Hono<AppContext>();

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
    if (c.req.path === "/health" || c.req.path.startsWith("/api/auth") || c.req.path === "/docs" || c.req.path === "/openapi.json") {
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

app.route("/shifts", shiftsRouter);
app.route("/worker", workerRouter);
app.route("/timesheets", timesheetsRouter);
app.route("/billing", billingRouter);
app.route("/organizations", organizationsRouter);
app.route("/geofence", geofenceRouter);

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
console.log(`🚀 WorkersHive API running at http://localhost:${port}`);

export default {
    port,
    fetch: app.fetch,
};

export { app };
