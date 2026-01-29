// packages/shifts/src/server.ts
// Combined API Gateway: Shifts + Geofence + API services

import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "@repo/auth"; // Import shared auth
import { db } from "@repo/database";
import { member } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";

// Shifts Controllers
import { getUpcomingShifts } from "./controllers/upcoming";
import { getPendingShifts } from "./controllers/pending";
import { getHistoryShifts } from "./controllers/history";
import { approveShiftController } from "./controllers/approve";
import { getShiftByIdController } from "./controllers/get-by-id";
import { getShiftTimesheetsController } from "./controllers/get-timesheets";
import { updateTimesheetController } from "./controllers/update-timesheet";
import { publishScheduleController } from "./controllers/publish";
import { getCrewController } from "./controllers/get-crew";
import { getDraftShifts } from "./controllers/drafts";
import { deleteDraftsController } from "./controllers/delete-drafts";
import { getWorkerShiftsController } from "./controllers/worker-shifts";
import { createLocationController } from "./controllers/create-location";
import { requestCorrectionController, getPendingCorrectionsController, reviewCorrectionController } from "@repo/geofence";
import { exportTimesheetsController } from "./controllers/export-timesheets";
import { getTimesheetsReportController } from "./controllers/get-timesheets-report";
import { getReportFiltersController } from "./controllers/get-report-filters";
import { cancelShiftController } from "./controllers/cancel";
import { assignWorkerController } from "./controllers/assign";
import { getAvailabilityController } from "./controllers/get-availability";
import { setAvailabilityController } from "./controllers/set-availability";
import { getShiftGroupController } from "./controllers/get-shift-group";

// Geofence Controllers
import { ingestLocationController } from "@repo/geofence/src/controllers/ingest-location";
import { clockInController } from "@repo/geofence/src/controllers/clock-in";
import { clockOutController } from "@repo/geofence/src/controllers/clock-out";
import { geocodeLocationController, geocodeAllLocationsController } from "@repo/geofence/src/controllers/geocode-location";
import { managerOverrideController } from "@repo/geofence/src/controllers/manager-override";
import { getFlaggedTimesheetsController } from "@repo/geofence/src/controllers/flagged-timesheets";

// API Routes (packages/api)
import devices from "@repo/api/src/routes/devices";
import preferences from "@repo/api/src/routes/preferences";
import managerPreferences from "@repo/api/src/routes/manager-preferences";
import shiftsRoute from "@repo/api/src/routes/shifts";

const app = new Hono<{
    Variables: {
        orgId: string;
        user: typeof auth.$Infer.Session.user | null;
        session: typeof auth.$Infer.Session.session | null
    };
}>();

// CORS Middleware
import { corsConfig } from "@repo/config";

// CORS Middleware
app.use(
    "*",
    cors(corsConfig)
);

// WH-113: Request Tracing
import { requestId, errorHandler, timeout } from "@repo/observability";
app.use("*", requestId());
app.use("*", timeout(30000));

// WH-112: Global Error Handler
app.onError((err, c) => errorHandler(err, c));

// Mount Auth Handler
app.on(["POST", "GET"], "/api/auth/*", (c) => {
    return auth.handler(c.req.raw);
});

// Authentication & Tenant Middleware
app.use("*", async (c, next) => {
    // Skip health and auth routes
    if (c.req.path === "/health" || c.req.path.startsWith("/api/auth")) {
        await next();
        return;
    }

    // 1. Validate Session from Headers
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    // Set Context
    c.set("user", session.user);
    c.set("session", session.session);

    // 2. Validate TenantContext
    const orgId = c.req.header("x-org-id");
    if (!orgId) {
        // Fallback: If no header, maybe use activeOrganizationId from session?
        // For now, strict requirement as per previous implementations
        return c.json({ error: "Missing Tenant Context" }, 401);
    }

    // 3. Verify Membership (The "Worker belongs to Org" check)
    // Strict membership check via DB query
    const memberRecord = await db.query.member.findFirst({
        where: and(
            eq(member.organizationId, orgId),
            eq(member.userId, session.user.id)
        ),
        columns: { id: true, role: true }
    });

    if (!memberRecord) {
        return c.json({ error: "Access Denied: Not a member of this organization" }, 403);
    }

    c.set("orgId", orgId);
    await next();
});

// Health Check
app.get("/health", (c) => c.text("OK"));

// ============================================================================
// GEOFENCE ROUTES (from packages/geofence/src/server.ts)
// ============================================================================

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
    const orgId = c.get("orgId");
    const body: any = await c.req.json();
    return await geocodeLocationController({ ...body, orgId });
});

app.post("/geocode/all", async (c) => {
    const orgId = c.get("orgId");
    return await geocodeAllLocationsController(orgId);
});

// Corrections & Exceptions (Geofence routes for corrections/override/flagged)
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

// ============================================================================
// API ROUTES (from packages/api/src/index.ts)
// ============================================================================

// Mount @repo/api routes
app.route('/devices', devices);
app.route('/preferences', preferences);
app.route('/manager-preferences', managerPreferences);
// Note: The shifts route from @repo/api provides "/shifts/upcoming" with geofence data
// We mount it separately to avoid conflicts with the shifts service routes
app.route('/api', shiftsRoute); // This will be available at /api/shifts/upcoming

// ============================================================================
// SHIFTS SERVICE ROUTES (original routes)
// ============================================================================

// Location Routes
app.post("/locations", async (c) => {
    const orgId = c.get('orgId');
    return await createLocationController(c.req.raw, orgId);
});

// Organization Routes
app.get("/organizations/:orgId/crew", async (c) => {
    const orgId = c.req.param("orgId");
    const headerOrgId = c.get('orgId');
    if (orgId !== headerOrgId) {
        return c.json({ error: "Organization mismatch" }, 403);
    }

    // WH-116: Crew Search & Pagination
    const search = c.req.query("search");
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const offset = parseInt(c.req.query("offset") || "0", 10);
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    return await getCrewController(headerOrgId, { search, limit: safeLimit, offset });
});

// [AVL-003] Get Availability
app.get("/organizations/:orgId/availability", async (c) => {
    const orgId = c.get('orgId');
    const from = c.req.query("from") || new Date().toISOString();
    const to = c.req.query("to") || new Date(Date.now() + 86400000 * 7).toISOString(); // Default 7 days
    const workerId = c.req.query("workerId");
    return await getAvailabilityController(orgId, from, to, workerId);
});

// Schedule Routes
app.post("/schedules/publish", async (c) => {
    const orgId = c.get('orgId');
    return await publishScheduleController(c.req.raw, orgId);
});

// [AVL-002] Worker Availability
app.post("/worker/availability", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return await setAvailabilityController(c.req.raw, user.id);
});

// Worker Shift Routes (WH-001)
app.get("/worker/shifts", async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const status = (c.req.query("status") as 'upcoming' | 'history' | 'all') || 'upcoming';
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");

    return await getWorkerShiftsController(user.id, orgId, { status, limit, offset });
});

app.post("/worker/adjustments", async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    return await requestCorrectionController(c.req.raw, user.id, orgId);
});

app.get("/adjustments/pending", async (c) => {
    const orgId = c.get('orgId');
    return await getPendingCorrectionsController(orgId);
});

app.post("/adjustments/review", async (c) => {
    const user = c.get("user");
    const orgId = c.get('orgId');
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    return await reviewCorrectionController(c.req.raw, user.id, orgId);
});

// Shift Routes
app.get("/shifts/upcoming", async (c) => {
    const orgId = c.get('orgId');
    return await getUpcomingShifts(orgId);
});

app.get("/shifts/pending-approval", async (c) => {
    const orgId = c.get('orgId');
    return await getPendingShifts(orgId);
});

// WH-115: History Pagination
app.get("/shifts/history", async (c) => {
    const orgId = c.get('orgId');

    // Parse pagination
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const offset = parseInt(c.req.query("offset") || "0", 10);

    // Validate sensible limits
    const safeLimit = Math.min(Math.max(limit, 1), 100); // 1-100
    const safeOffset = Math.max(offset, 0);

    return await getHistoryShifts(orgId, { limit: safeLimit, offset: safeOffset });
});

app.get("/shifts/drafts", async (c) => {
    const orgId = c.get('orgId');
    return await getDraftShifts(orgId);
});

app.delete("/shifts/drafts", async (c) => {
    const orgId = c.get('orgId');
    return await deleteDraftsController(orgId);
});

// [FEAT-009] Shift Group Endpoint
app.get("/shifts/groups/:groupId", async (c) => {
    const groupId = c.req.param("groupId");
    const orgId = c.get('orgId');
    return await getShiftGroupController(groupId, orgId);
});

app.get("/shifts/:id", async (c) => {
    const id = c.req.param("id");
    const orgId = c.get('orgId');
    return await getShiftByIdController(id, orgId);
});

app.post("/shifts/:id/approve", async (c) => {
    const id = c.req.param("id");
    const orgId = c.get('orgId');
    const user = c.get('user');
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    return await approveShiftController(id, orgId, user.id);
});

app.post("/shifts/:id/cancel", async (c) => {
    const id = c.req.param("id");
    const orgId = c.get('orgId');
    const user = c.get('user');
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    return await cancelShiftController(id, orgId, user.id);
});

app.post("/shifts/:id/assign", async (c) => {
    const id = c.req.param("id");
    const orgId = c.get('orgId');
    return await assignWorkerController(c.req.raw, id, orgId);
});

app.get("/shifts/:id/timesheets", async (c) => {
    const id = c.req.param("id");
    const orgId = c.get('orgId');
    return await getShiftTimesheetsController(id, orgId);
});

app.patch("/shifts/:shiftId/timesheet", async (c) => {
    const orgId = c.get('orgId');
    return await updateTimesheetController(c.req.raw, orgId);
});

// Timesheets Preview (JSON for Reports UI)
app.get("/timesheets", async (c) => {
    const orgId = c.get('orgId');
    const queryParams: Record<string, string> = {};
    const url = new URL(c.req.url);
    url.searchParams.forEach((value, key) => {
        queryParams[key] = value;
    });
    return await getTimesheetsReportController(orgId, queryParams);
});

// Report Filter Options
app.get("/timesheets/filters", async (c) => {
    const orgId = c.get('orgId');
    const queryParams: Record<string, string> = {};
    const url = new URL(c.req.url);
    url.searchParams.forEach((value, key) => {
        queryParams[key] = value;
    });
    return await getReportFiltersController(orgId, queryParams);
});

app.get("/timesheets/export", async (c) => {
    const orgId = c.get('orgId');

    // Collect all query params
    const queryParams: Record<string, string> = {};
    const url = new URL(c.req.url);
    url.searchParams.forEach((value, key) => {
        queryParams[key] = value;
    });

    return await exportTimesheetsController(orgId, queryParams);
});

const port = process.env.PORT || 4005;
console.log(`🚀 Combined API Gateway running at http://localhost:${port}`);
console.log(`   ✓ Shifts Service routes`);
console.log(`   ✓ Geofence Service routes (/clock-in, /clock-out, /location)`);
console.log(`   ✓ API Service routes (/devices, /preferences)`);

export default {
    port,
    fetch: app.fetch,
};
