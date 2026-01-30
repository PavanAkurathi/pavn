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
import { cancelShiftController } from "./controllers/cancel";
import { assignWorkerController } from "./controllers/assign";

// Import new middleware
import { getUserRole, requireManager, requireAdmin, requirePermission, type Role } from "./middleware/rbac";
import { rateLimit, RATE_LIMITS } from "./middleware/rate-limit";

const app = new Hono<{
    Variables: {
        orgId: string;
        user: typeof auth.$Infer.Session.user | null;
        session: typeof auth.$Infer.Session.session | null;
        userRole: Role | null;
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
        return c.json({ error: "Missing Tenant Context" }, 401);
    }

    // 3. Verify Membership AND Get Role
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

    // Set role in context for RBAC middleware
    c.set("orgId", orgId);
    c.set("userRole", memberRecord.role as Role);
    
    await next();
});

// Health Check
app.get("/health", (c) => c.text("OK"));

// Location Routes (Manager+ only)
app.post("/locations", requireManager(), async (c) => {
    const orgId = c.get('orgId');
    return await createLocationController(c.req.raw, orgId);
});

// Organization Routes
app.get("/organizations/:orgId/crew", requireManager(), async (c) => {
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
import { getAvailabilityController } from "./controllers/get-availability";
app.get("/organizations/:orgId/availability", requireManager(), async (c) => {
    const orgId = c.get('orgId');
    const from = c.req.query("from") || new Date().toISOString();
    const to = c.req.query("to") || new Date(Date.now() + 86400000 * 7).toISOString(); // Default 7 days
    const workerId = c.req.query("workerId");
    return await getAvailabilityController(orgId, from, to, workerId);
});

// Schedule Routes (Manager+ only)
app.post("/schedules/publish", requireManager(), rateLimit(RATE_LIMITS.publish), async (c) => {
    const orgId = c.get('orgId');
    return await publishScheduleController(c.req.raw, orgId);
});

// [AVL-002] Worker Availability (Workers can set their own)
import { setAvailabilityController } from "./controllers/set-availability";
app.post("/worker/availability", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return await setAvailabilityController(c.req.raw, user.id);
});

// Worker Shift Routes (WH-001) - Workers can access their own shifts
app.get("/worker/shifts", async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const status = (c.req.query("status") as 'upcoming' | 'history' | 'all') || 'upcoming';
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");

    return await getWorkerShiftsController(user.id, orgId, { status, limit, offset });
});

// Workers can request adjustments (rate limited)
app.post("/worker/adjustments", rateLimit(RATE_LIMITS.api), async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    return await requestCorrectionController(c.req.raw, user.id, orgId);
});

// Manager+ only: View pending adjustments
app.get("/adjustments/pending", requireManager(), async (c) => {
    const orgId = c.get('orgId');
    return await getPendingCorrectionsController(orgId);
});

// Manager+ only: Review adjustments
app.post("/adjustments/review", requireManager(), async (c) => {
    const user = c.get("user");
    const orgId = c.get('orgId');
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    return await reviewCorrectionController(c.req.raw, user.id, orgId);
});

// Shift Routes (Manager+ for listing all shifts)
app.get("/shifts/upcoming", requireManager(), async (c) => {
    const orgId = c.get('orgId');
    return await getUpcomingShifts(orgId);
});

app.get("/shifts/pending-approval", requireManager(), async (c) => {
    const orgId = c.get('orgId');
    return await getPendingShifts(orgId);
});

// WH-115: History Pagination
app.get("/shifts/history", requireManager(), async (c) => {
    const orgId = c.get('orgId');

    // Parse pagination
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const offset = parseInt(c.req.query("offset") || "0", 10);

    // Validate sensible limits
    const safeLimit = Math.min(Math.max(limit, 1), 100); // 1-100
    const safeOffset = Math.max(offset, 0);

    return await getHistoryShifts(orgId, { limit: safeLimit, offset: safeOffset });
});

app.get("/shifts/drafts", requireManager(), async (c) => {
    const orgId = c.get('orgId');
    return await getDraftShifts(orgId);
});

app.delete("/shifts/drafts", requireManager(), async (c) => {
    const orgId = c.get('orgId');
    return await deleteDraftsController(orgId);
});

// [FEAT-009] Shift Group Endpoint
import { getShiftGroupController } from "./controllers/get-shift-group";
app.get("/shifts/groups/:groupId", requireManager(), async (c) => {
    const groupId = c.req.param("groupId");
    const orgId = c.get('orgId');
    return await getShiftGroupController(groupId, orgId);
});

// Single shift access - workers can view if assigned, managers can view all
app.get("/shifts/:id", async (c) => {
    const id = c.req.param("id");
    const orgId = c.get('orgId');
    // Note: getShiftByIdController should check if user is assigned or is manager
    return await getShiftByIdController(id, orgId);
});

// Manager+ only: Approve shifts
app.post("/shifts/:id/approve", requireManager(), async (c) => {
    const id = c.req.param("id");
    const orgId = c.get('orgId');
    const user = c.get('user');
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    return await approveShiftController(id, orgId, user.id);
});

// Manager+ only: Cancel shifts
app.post("/shifts/:id/cancel", requireManager(), async (c) => {
    const id = c.req.param("id");
    const orgId = c.get('orgId');
    const user = c.get('user');
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    return await cancelShiftController(id, orgId, user.id);
});

// Manager+ only: Assign workers
app.post("/shifts/:id/assign", requireManager(), async (c) => {
    const id = c.req.param("id");
    const orgId = c.get('orgId');
    return await assignWorkerController(c.req.raw, id, orgId);
});

// Manager+ only: View timesheets
app.get("/shifts/:id/timesheets", requireManager(), async (c) => {
    const id = c.req.param("id");
    const orgId = c.get('orgId');
    return await getShiftTimesheetsController(id, orgId);
});

// Manager+ only: Update timesheets
app.patch("/shifts/:shiftId/timesheet", requireManager(), async (c) => {
    const orgId = c.get('orgId');
    return await updateTimesheetController(c.req.raw, orgId);
});

// Timesheets Preview (JSON for Reports UI) - Manager+ only
app.get("/timesheets", requireManager(), async (c) => {
    const orgId = c.get('orgId');
    const queryParams: Record<string, string> = {};
    const url = new URL(c.req.url);
    url.searchParams.forEach((value, key) => {
        queryParams[key] = value;
    });
    return await getTimesheetsReportController(orgId, queryParams);
});

// Report Filter Options - Manager+ only
app.get("/timesheets/filters", requireManager(), async (c) => {
    const orgId = c.get('orgId');
    const queryParams: Record<string, string> = {};
    const url = new URL(c.req.url);
    url.searchParams.forEach((value, key) => {
        queryParams[key] = value;
    });
    return await getReportFiltersController(orgId, queryParams);
});

// Manager+ only: Export timesheets
app.get("/timesheets/export", requireManager(), async (c) => {
    const orgId = c.get('orgId');

    // Collect all query params
    const queryParams: Record<string, string> = {};
    const url = new URL(c.req.url);
    url.searchParams.forEach((value, key) => {
        queryParams[key] = value;
    });

    return await exportTimesheetsController(orgId, queryParams);
});

// ============================================================================
// PAYMENT ROUTES - Admin ONLY (Managers cannot CRUD payment methods)
// ============================================================================
app.get("/billing/payment-methods", requireAdmin(), async (c) => {
    // TODO: Implement payment methods list
    return c.json({ paymentMethods: [], message: "Not yet implemented" });
});

app.post("/billing/payment-methods", requireAdmin(), async (c) => {
    // TODO: Implement add payment method
    return c.json({ error: "Not yet implemented" }, 501);
});

app.delete("/billing/payment-methods/:id", requireAdmin(), async (c) => {
    // TODO: Implement delete payment method
    return c.json({ error: "Not yet implemented" }, 501);
});

app.patch("/billing/payment-methods/:id/default", requireAdmin(), async (c) => {
    // TODO: Implement set default payment method
    return c.json({ error: "Not yet implemented" }, 501);
});

// Admin only: Organization settings
app.patch("/settings/organization", requireAdmin(), async (c) => {
    // TODO: Implement org settings update
    return c.json({ error: "Not yet implemented" }, 501);
});

const port = process.env.PORT || 4005;
console.log(`🦊 Service is running at http://localhost:${port}`);

export default {
    port,
    fetch: app.fetch,
};
