/**
 * @fileoverview Geofence and Time Clock Routes
 * @module apps/api/routes/geofence
 * 
 * Handles worker clock in/out operations with GPS verification,
 * and time correction request workflows.
 * 
 * @description
 * This router powers the core time tracking functionality:
 * - GPS-verified clock in/out (workers)
 * - Time correction/adjustment requests (workers)
 * - Pending corrections queue (managers)
 * - Correction review/approval (managers)
 * 
 * Clock actions are rate-limited (5/minute) to prevent spam.
 * Location is verified against venue geofence before allowing clock.
 * 
 * RBAC Rules:
 * - All authenticated users can clock in/out and request corrections
 * - Managers can view pending corrections and approve/deny them
 * 
 * Endpoints:
 * - POST /clock-in - Clock in with GPS coordinates (rate limited)
 * - POST /clock-out - Clock out with GPS coordinates (rate limited)
 * - POST /corrections - Submit time correction request
 * - GET /pending - List pending correction requests (manager+)
 * - POST /review - Approve/deny correction request (manager+)
 * - POST /verify-location - Check if at venue without clocking
 * 
 * @requires @repo/geofence - Clock and correction controllers
 * @author WorkersHive Team
 * @since 1.0.0
 */

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

// Manager+ only: Review correction requests (approve/deny)
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
    // Useful for checking if worker is at the venue before shift starts
    return c.json({ 
        verified: false, 
        message: "Not yet implemented" 
    }, 501);
});

export default geofenceRouter;
