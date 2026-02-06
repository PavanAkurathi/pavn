/**
 * @fileoverview Manager Preferences Routes
 * @module apps/api/routes/manager-preferences
 * 
 * Handles manager notification preferences and settings.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "@repo/database";
import { managerNotificationPreferences } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import type { AppContext } from "../index";

export const managerPreferencesRouter = new OpenAPIHono<AppContext>();

// =============================================================================
// SCHEMAS
// =============================================================================

const ManagerPreferencesSchema = z.object({
    managerId: z.string(),
    clockInAlertsEnabled: z.boolean().default(true),
    clockOutAlertsEnabled: z.boolean().default(true),
    shiftScope: z.enum(['all', 'booked_by_me', 'onsite_contact']).default('all'),
    locationScope: z.enum(['all', 'selected']).default('all'),
    updatedAt: z.date().or(z.string()).optional()
});

const UpdateManagerPreferencesSchema = z.object({
    clockInAlertsEnabled: z.boolean().optional(),
    clockOutAlertsEnabled: z.boolean().optional(),
    shiftScope: z.enum(['all', 'booked_by_me', 'onsite_contact']).optional(),
    locationScope: z.enum(['all', 'selected']).optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

const getPreferencesRoute = createRoute({
    method: 'get',
    path: '/',
    summary: 'Get Manager Preferences',
    description: 'Get manager notification preferences.',
    responses: {
        200: {
            content: { 'application/json': { schema: z.object({ preferences: ManagerPreferencesSchema }) } },
            description: 'Manager preferences'
        },
        401: { description: 'Unauthorized' }
    }
});

managerPreferencesRouter.openapi(getPreferencesRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    let prefs = await db.query.managerNotificationPreferences.findFirst({
        where: eq(managerNotificationPreferences.managerId, user.id)
    });

    if (!prefs) {
        // Create defaults if not exists
        [prefs] = await db.insert(managerNotificationPreferences)
            .values({
                managerId: user.id,
                clockInAlertsEnabled: true,
                clockOutAlertsEnabled: true,
                shiftScope: 'all',
                locationScope: 'all'
            })
            .returning();
    }

    return c.json({ preferences: prefs } as any, 200);
});

const updatePreferencesRoute = createRoute({
    method: 'patch',
    path: '/',
    summary: 'Update Manager Preferences',
    description: 'Update manager notification preferences.',
    request: {
        body: {
            content: {
                'application/json': { schema: UpdateManagerPreferencesSchema }
            }
        }
    },
    responses: {
        200: {
            content: { 'application/json': { schema: z.object({ preferences: ManagerPreferencesSchema }) } },
            description: 'Updated preferences'
        },
        401: { description: 'Unauthorized' }
    }
});

managerPreferencesRouter.openapi(updatePreferencesRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const data = await c.req.json();
    const parsed = UpdateManagerPreferencesSchema.safeParse(data);

    if (!parsed.success) {
        return c.json({ error: "Invalid data" }, 400);
    }

    // Upsert preferences
    const [updatedPrefs] = await db.insert(managerNotificationPreferences)
        .values({
            managerId: user.id,
            ...parsed.data
        })
        .onConflictDoUpdate({
            target: managerNotificationPreferences.managerId,
            set: {
                ...parsed.data,
                updatedAt: new Date()
            }
        })
        .returning();

    return c.json({ preferences: updatedPrefs } as any, 200);
});

export default managerPreferencesRouter;
