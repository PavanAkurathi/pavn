// packages/geofence/src/server.ts

import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "@repo/auth";
import { db } from "@repo/database";
import { member } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";

const app = new Hono<{
    Variables: {
        orgId: string;
        user: typeof auth.$Infer.Session.user | null;
        session: typeof auth.$Infer.Session.session | null;
    };
}>();

// CORS
import { corsConfig } from "@repo/config";

// ...

// CORS
app.use("*", cors(corsConfig));

// WH-113: Request Tracing
import { requestId, errorHandler, timeout } from "@repo/observability";
app.use("*", requestId());
app.use("*", timeout(30000));

// WH-112: Global Error Handler
app.onError((err, c) => errorHandler(err, c));

// Auth Middleware (same pattern as shifts package)
app.use("*", async (c, next) => {
    if (c.req.path === "/health") {
        await next();
        return;
    }

    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        c.set("user", session.user);
        c.set("session", session.session);

        const orgId = c.req.header("x-org-id");
        if (!orgId) {
            return c.json({ error: "Missing Tenant Context" }, 401);
        }

        // Strict Membership Check
        const memberRecord = await db.query.member.findFirst({
            where: and(
                eq(member.organizationId, orgId),
                eq(member.userId, session.user.id)
            ),
            columns: { id: true }
        });

        if (!memberRecord) {
            return c.json({ error: "Access Denied: Not a member of this organization" }, 403);
        }

        c.set("orgId", orgId);
        await next();
    } catch (e) {
        console.error("Auth Middleware Error:", e);
        return c.json({ error: "Authentication Failed" }, 401);
    }
});

// Health Check
app.get("/health", (c) => c.text("OK"));

// Routes
import { ingestLocationController } from "./controllers/ingest-location";
import { clockInController } from "./controllers/clock-in";
import { clockOutController } from "./controllers/clock-out";
import { geocodeLocationController, geocodeAllLocationsController } from "./controllers/geocode-location";
import { requestCorrectionController } from "./controllers/request-correction";
import { reviewCorrectionController } from "./controllers/review-correction";
import { managerOverrideController } from "./controllers/manager-override";
import { getFlaggedTimesheetsController } from "./controllers/flagged-timesheets";

// Geofence & Location
app.post("/location", async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return await ingestLocationController(c.req.raw, user.id, orgId);
});

// Timeclock
app.post("/clock-in", async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return await clockInController(c.req.raw, user.id, orgId);
});

app.post("/clock-out", async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return await clockOutController(c.req.raw, user.id, orgId);
});

// Geocoding
app.post("/geocode", async (c) => {
    // Manager only ideally, but we'll assume auth middleware + controller checks or valid orgId is enough for now
    // Controller handles validation but ideally we check role here too.
    const orgId = c.get("orgId");
    const body: any = await c.req.json();
    return await geocodeLocationController({ ...body, orgId });
});

app.post("/geocode/all", async (c) => {
    const orgId = c.get("orgId");
    return await geocodeAllLocationsController(orgId);
});

// Corrections & Exceptions
app.post("/corrections", async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return await requestCorrectionController(c.req.raw, user.id, orgId);
});

app.post("/corrections/review", async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return await reviewCorrectionController(c.req.raw, user.id, orgId);
});

app.post("/override", async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return await managerOverrideController(c.req.raw, user.id, orgId);
});

app.get("/flagged", async (c) => {
    const orgId = c.get("orgId");
    return await getFlaggedTimesheetsController(orgId);
});

const port = process.env.GEOFENCE_PORT ? parseInt(process.env.GEOFENCE_PORT) : 4007;
console.log(`📍 Geofence service running at http://localhost:${port}`);

export default {
    port,
    fetch: app.fetch,
};
