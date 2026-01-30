// apps/api/src/routes/worker.ts
// Worker-facing Routes (shifts, availability, adjustments)

import { Hono } from "hono";
import type { AppContext } from "../index";
import { rateLimit, RATE_LIMITS } from "../middleware";

// Import controllers
import { getWorkerShiftsController, setAvailabilityController } from "@repo/shifts";
import { requestCorrectionController } from "@repo/geofence";

export const workerRouter = new Hono<AppContext>();

// =============================================================================
// WORKER SHIFTS
// =============================================================================

workerRouter.get("/shifts", async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const status = (c.req.query("status") as "upcoming" | "history" | "all") || "upcoming";
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");

    return await getWorkerShiftsController(user.id, orgId, { status, limit, offset });
});

// =============================================================================
// AVAILABILITY
// =============================================================================

workerRouter.post("/availability", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return await setAvailabilityController(c.req.raw, user.id);
});

workerRouter.get("/availability", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    // TODO: Implement get worker's own availability
    return c.json({ availability: [], message: "Not yet implemented" });
});

// =============================================================================
// ADJUSTMENT REQUESTS
// =============================================================================

workerRouter.post("/adjustments", rateLimit(RATE_LIMITS.api), async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    return await requestCorrectionController(c.req.raw, user.id, orgId);
});

workerRouter.get("/adjustments", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    // TODO: Implement get worker's own adjustment requests
    return c.json({ adjustments: [], message: "Not yet implemented" });
});

// =============================================================================
// PROFILE
// =============================================================================

workerRouter.get("/profile", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    return c.json({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
    });
});

workerRouter.patch("/profile", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    // TODO: Implement profile update
    return c.json({ error: "Not yet implemented" }, 501);
});

export default workerRouter;
