/**
 * @fileoverview Organization Management Routes
 * @module apps/api/routes/organizations
 * 
 * Handles crew management, availability viewing, location management,
 * and organization settings.
 * 
 * @description
 * This router manages the organizational structure of WorkersHive:
 * - Crew (workers/members) listing and management
 * - Worker availability for scheduling
 * - Venue/location management
 * - Organization-wide settings
 * 
 * RBAC Rules:
 * - Managers can view and invite crew, manage locations
 * - Admins can remove crew members, delete locations, update settings
 * 
 * Endpoints:
 * - GET /:orgId/crew - List crew members with search/pagination
 * - POST /:orgId/crew/invite - Invite new worker (manager+)
 * - DELETE /:orgId/crew/:memberId - Remove crew member (admin+)
 * - GET /:orgId/availability - Get worker availability for date range
 * - GET /:orgId/locations - List venue locations
 * - POST /locations - Create new location
 * - PATCH /:orgId/locations/:locationId - Update location
 * - DELETE /:orgId/locations/:locationId - Delete location (admin+)
 * - GET /:orgId/settings - Get org settings
 * - PATCH /:orgId/settings - Update org settings (admin+)
 * 
 * @requires @repo/shifts - Crew and availability controllers
 * @author WorkersHive Team
 * @since 1.0.0
 */

import { Hono } from "hono";
import type { AppContext } from "../index";
import { requireManager, requireAdmin } from "../middleware";

// Import controllers
import { 
    getCrewController, 
    getAvailabilityController,
    createLocationController 
} from "@repo/shifts";

export const organizationsRouter = new Hono<AppContext>();

// =============================================================================
// CREW MANAGEMENT
// =============================================================================

organizationsRouter.get("/:orgId/crew", requireManager(), async (c) => {
    const orgId = c.req.param("orgId");
    const headerOrgId = c.get("orgId");
    
    // Ensure URL org matches header org (prevent cross-org access)
    if (orgId !== headerOrgId) {
        return c.json({ error: "Organization mismatch", code: "ORG_MISMATCH" }, 403);
    }

    const search = c.req.query("search");
    const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "50"), 1), 100);
    const offset = Math.max(parseInt(c.req.query("offset") || "0"), 0);

    return await getCrewController(headerOrgId, { search, limit, offset });
});

organizationsRouter.post("/:orgId/crew/invite", requireManager(), async (c) => {
    // TODO: Implement worker invitation via email/SMS
    return c.json({ error: "Not yet implemented" }, 501);
});

organizationsRouter.delete("/:orgId/crew/:memberId", requireAdmin(), async (c) => {
    // TODO: Implement crew member removal
    return c.json({ error: "Not yet implemented" }, 501);
});

// =============================================================================
// AVAILABILITY
// =============================================================================

organizationsRouter.get("/:orgId/availability", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    const from = c.req.query("from") || new Date().toISOString();
    const to = c.req.query("to") || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const workerId = c.req.query("workerId");
    return await getAvailabilityController(orgId, from, to, workerId);
});

// =============================================================================
// LOCATIONS
// =============================================================================

organizationsRouter.get("/:orgId/locations", requireManager(), async (c) => {
    // TODO: Implement location listing
    return c.json({ locations: [] });
});

organizationsRouter.post("/locations", requireManager(), async (c) => {
    const orgId = c.get("orgId");
    return await createLocationController(c.req.raw, orgId);
});

organizationsRouter.patch("/:orgId/locations/:locationId", requireManager(), async (c) => {
    // TODO: Implement location update
    return c.json({ error: "Not yet implemented" }, 501);
});

organizationsRouter.delete("/:orgId/locations/:locationId", requireAdmin(), async (c) => {
    // TODO: Implement location deletion (soft delete)
    return c.json({ error: "Not yet implemented" }, 501);
});

// =============================================================================
// ORGANIZATION SETTINGS (Admin only for updates)
// =============================================================================

organizationsRouter.get("/:orgId/settings", requireManager(), async (c) => {
    // TODO: Implement settings retrieval from database
    return c.json({
        name: "Organization",
        timezone: "America/New_York",
        clockRules: {
            earlyClockInMinutes: 15,
            autoClockOutAfterHours: 12,
            requireGeofence: true,
            geofenceRadiusMeters: 150,
        },
    });
});

organizationsRouter.patch("/:orgId/settings", requireAdmin(), async (c) => {
    // TODO: Implement settings update
    return c.json({ error: "Not yet implemented" }, 501);
});

export default organizationsRouter;
