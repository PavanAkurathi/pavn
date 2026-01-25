// packages/shifts/src/server.ts

import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "@repo/auth"; // Import shared auth
import { db } from "@repo/database";
import { member } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
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

const app = new Hono<{
    Variables: {
        orgId: string;
        user: typeof auth.$Infer.Session.user | null;
        session: typeof auth.$Infer.Session.session | null
    };
}>();

// CORS Middleware
import { corsConfig } from "@repo/config";

// ...

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

// Location Routes
app.post("/locations", async (c) => {
    const orgId = c.get('orgId');
    return await createLocationController(c.req.raw, orgId);
});

// Organization Routes
app.get("/organizations/:orgId/crew", async (c) => {
    const orgId = c.req.param("orgId");
    // Validate that param matches header? 
    // Ideally yes, but for now header is source of truth for DB queries usually.
    // The previous getCrewController used the param as orgId.
    // We should enforce that the header orgId matches the param orgId or just use header.
    // The user requirement says "filter ALL database queries by them [x-org-id]".
    // So we should use c.get('orgId').
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
import { getAvailabilityController } from "./controllers/get-availability";
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
    // publishScheduleController needs to be updated to take orgId
    return await publishScheduleController(c.req.raw, orgId);
});

// [AVL-002] Worker Availability
import { setAvailabilityController } from "./controllers/set-availability";
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
    // Ensure user is manager/admin? Middleware currently only checks valid session + org context.
    // In V2 we might want strict role checks. For now, matching existing pattern.
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
import { getShiftGroupController } from "./controllers/get-shift-group";
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
console.log(`🦊 Service is running at http://localhost:${port}`);

export default {
    port,
    fetch: app.fetch,
};
