// apps/api/src/routes/geofence.ts
// Geofence & Clock In/Out Routes

import { Hono } from "hono";
import type { AppContext } from "../index";
import { requireManager } from "../middleware";
import { rateLimit, RATE_LIMITS } from "../middleware";

// Import controllers from geofence package
import {
    clockInController,
    clockOutController,
    requestCorrectionController,
    getPendingCorrectionsController,
    reviewCorrectionController,
} from "@repo/geofence";

export const geofenceRouter = new Hono<AppContext>();

// =============================================================================
// CLOCK IN/OUT (Rate limited to prevent spam)
// =============================================================================

geofenceRouter.post("/clock-in", rateLimit(RATE_LIMITS.clockAction), async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    return await clockInController(c.req.raw, user.id, orgId);
});

geofenceRouter.post("/clock-out", rateLimit(RATE_LIMITS.clockAction), async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    return await clockOutController(c.req.raw, user.id, orgId);
});

// =============================================================================
// ADJUSTMENT/CORRECTION REQUESTS
// =============================================================================

// Workers can request corrections (rate limited)
geofenceRouter.post("/corrections", rateLimit(RATE_LIMITS.api), async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    return await requestCorrectionController(c.req.raw, user.id, orgId);
});

// Manager+ only: View pending corrections
geofenceRouter.get("/pending", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    return await getPendingCorrectionsController(orgId);
});

// Manager+ only: Review correction requests
geofenceRouter.post("/review", requireManager(), async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    return await reviewCorrectionController(c.req.raw, user.id, orgId);
});

// =============================================================================
// LOCATION VERIFICATION
// =============================================================================

geofenceRouter.post("/verify-location", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    // TODO: Implement location verification without clocking in/out
    // Useful for checking if worker is at the venue
    return c.json({ 
        verified: false, 
        message: "Not yet implemented" 
    }, 501);
});

export default geofenceRouter;
