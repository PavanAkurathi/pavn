// packages/shifts/src/server.ts

import { Hono } from "hono";
import { cors } from "hono/cors";
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

const app = new Hono<{
    Variables: {
        orgId: string;
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
        ],
        allowHeaders: ["x-org-id", "Content-Type", "Authorization"],
        allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
        exposeHeaders: ["Content-Length"],
        maxAge: 600,
        credentials: true,
    })
);

// Tenant Isolation Middleware
app.use("*", async (c, next) => {
    if (c.req.path === "/health") {
        await next();
        return;
    }

    const orgId = c.req.header("x-org-id");
    if (!orgId) {
        return c.json({ error: "Missing Tenant Context" }, 401);
    }

    c.set("orgId", orgId);
    await next();
});

// Health Check
app.get("/health", (c) => c.text("OK"));

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
