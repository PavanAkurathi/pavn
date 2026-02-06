/**
 * @fileoverview Worker Preferences Routes
 * @module apps/api/routes/preferences
 * 
 * Handles worker notification preferences and settings.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "@repo/database";
import { workerNotificationPreferences } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import type { AppContext } from "../index";

export const preferencesRouter = new OpenAPIHono<AppContext>();

// =============================================================================
// SCHEMAS
// =============================================================================

const PreferencesSchema = z.object({
    workerId: z.string(),
    nightBeforeEnabled: z.boolean().default(true),
    sixtyMinEnabled: z.boolean().default(true),
    fifteenMinEnabled: z.boolean().default(true),
    shiftStartEnabled: z.boolean().default(true),
    lateWarningEnabled: z.boolean().default(true),
    geofenceAlertsEnabled: z.boolean().default(true),
    quietHoursEnabled: z.boolean().default(false),
    quietHoursStart: z.string().nullable().optional(),
    quietHoursEnd: z.string().nullable().optional(),
    updatedAt: z.date().or(z.string()).optional()
});

const UpdatePreferencesSchema = z.object({
    nightBeforeEnabled: z.boolean().optional(),
    sixtyMinEnabled: z.boolean().optional(),
    fifteenMinEnabled: z.boolean().optional(),
    shiftStartEnabled: z.boolean().optional(),
    lateWarningEnabled: z.boolean().optional(),
    geofenceAlertsEnabled: z.boolean().optional(),
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: z.string().nullable().optional(),
    quietHoursEnd: z.string().nullable().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

const getPreferencesRoute = createRoute({
    method: 'get',
    path: '/',
    summary: 'Get Preferences',
    description: 'Get worker notification preferences.',
    responses: {
        200: {
            content: { 'application/json': { schema: z.object({ preferences: PreferencesSchema }) } },
            description: 'User preferences'
        },
        401: { description: 'Unauthorized' }
    }
});

preferencesRouter.openapi(getPreferencesRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    let prefs = await db.query.workerNotificationPreferences.findFirst({
        where: eq(workerNotificationPreferences.workerId, user.id)
    });

    if (!prefs) {
        // Create defaults if not exists
        [prefs] = await db.insert(workerNotificationPreferences)
            .values({
                workerId: user.id
            })
            .returning();
    }

    return c.json({ preferences: prefs } as any, 200);
});

const updatePreferencesRoute = createRoute({
    method: 'patch',
    path: '/',
    summary: 'Update Preferences',
    description: 'Update worker notification preferences.',
    request: {
        body: {
            content: {
                'application/json': { schema: UpdatePreferencesSchema }
            }
        }
    },
    responses: {
        200: {
            content: { 'application/json': { schema: z.object({ preferences: PreferencesSchema }) } },
            description: 'Updated preferences'
        },
        401: { description: 'Unauthorized' }
    }
});

preferencesRouter.openapi(updatePreferencesRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const data = await c.req.json();
    const parsed = UpdatePreferencesSchema.safeParse(data);

    if (!parsed.success) {
        return c.json({ error: "Invalid data" }, 400);
    }

    // Upsert preferences
    const [updatedPrefs] = await db.insert(workerNotificationPreferences)
        .values({
            workerId: user.id,
            ...parsed.data
        })
        .onConflictDoUpdate({
            target: workerNotificationPreferences.workerId,
            set: {
                ...parsed.data,
                updatedAt: new Date()
            }
        })
        .returning();

    return c.json({ preferences: updatedPrefs } as any, 200);
});

export default preferencesRouter;
