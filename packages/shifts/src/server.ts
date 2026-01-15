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
import { createAdjustmentRequestController } from "./controllers/create-adjustment";
import { getPendingAdjustmentsController, reviewAdjustmentController } from "./controllers/review-adjustments";

const app = new Hono<{
    Variables: {
        orgId: string;
        user: typeof auth.$Infer.Session.user | null;
        session: typeof auth.$Infer.Session.session | null
    };
}>();

// CORS Middleware
app.use(
    "*",
    cors({
        origin: [
            "http://localhost:3000",
            "http://localhost:3001",
            "https://muttonbiryani.up.railway.app",
            "https://shift-serf.up.railway.app",
            // Allow all Expo dev tunnels (or specific ones if known)
            "exp://",
        ],
        allowHeaders: ["x-org-id", "Content-Type", "Authorization"],
        allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
        exposeHeaders: ["Content-Length"],
        maxAge: 600,
        credentials: true,
    })
);

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
    return await getCrewController(headerOrgId);
});

// Schedule Routes
app.post("/schedules/publish", async (c) => {
    const orgId = c.get('orgId');
    // publishScheduleController needs to be updated to take orgId
    return await publishScheduleController(c.req.raw, orgId);
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

    return await createAdjustmentRequestController(c.req.raw, user.id, orgId);
});

app.get("/adjustments/pending", async (c) => {
    const orgId = c.get('orgId');
    // Ensure user is manager/admin? Middleware currently only checks valid session + org context.
    // In V2 we might want strict role checks. For now, matching existing pattern.
    return await getPendingAdjustmentsController(orgId);
});

app.post("/adjustments/review", async (c) => {
    const user = c.get("user");
    const orgId = c.get('orgId');
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    return await reviewAdjustmentController(c.req.raw, user.id, orgId);
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

app.get("/shifts/history", async (c) => {
    const orgId = c.get('orgId');
    return await getHistoryShifts(orgId);
});

app.get("/shifts/drafts", async (c) => {
    const orgId = c.get('orgId');
    return await getDraftShifts(orgId);
});

app.delete("/shifts/drafts", async (c) => {
    const orgId = c.get('orgId');
    return await deleteDraftsController(orgId);
});

app.get("/shifts/:id", async (c) => {
    const id = c.req.param("id");
    const orgId = c.get('orgId');
    return await getShiftByIdController(id, orgId);
});

app.post("/shifts/:id/approve", async (c) => {
    const id = c.req.param("id");
    const orgId = c.get('orgId');
    return await approveShiftController(id, orgId);
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

const port = process.env.PORT || 4005;
console.log(`🦊 Service is running at http://localhost:${port}`);

export default {
    port,
    fetch: app.fetch,
};
