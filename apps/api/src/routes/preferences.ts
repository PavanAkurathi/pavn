/**
 * @fileoverview Worker Preferences Routes
 * @module apps/api/routes/preferences
 * 
 * Handles worker notification preferences and settings.
 */

import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import {
    SecurityOverviewSchema,
    UpdateWorkerPreferencesSchema,
    WorkerPreferencesResponseSchema,
} from "@repo/contracts/preferences";
import { db } from "@repo/database";
import { workerNotificationPreferences } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import type { AppContext } from "../index";
import { getSecurityOverview } from "../lib/organization-workspace.js";

export const preferencesRouter = new OpenAPIHono<AppContext>();

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
            content: { 'application/json': { schema: WorkerPreferencesResponseSchema } },
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
                'application/json': { schema: UpdateWorkerPreferencesSchema }
            }
        }
    },
    responses: {
        200: {
            content: { 'application/json': { schema: WorkerPreferencesResponseSchema } },
            description: 'Updated preferences'
        },
        401: { description: 'Unauthorized' }
    }
});

preferencesRouter.openapi(updatePreferencesRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const data = await c.req.json();
    const parsed = UpdateWorkerPreferencesSchema.safeParse(data);

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

const getSecurityOverviewRoute = createRoute({
    method: "get",
    path: "/security",
    summary: "Get Security Overview",
    description: "Get linked accounts and active sessions for the current user.",
    responses: {
        200: {
            content: {
                "application/json": { schema: SecurityOverviewSchema },
            },
            description: "Security overview",
        },
        401: { description: "Unauthorized" },
    },
});

preferencesRouter.openapi(getSecurityOverviewRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const result = await getSecurityOverview(user.id);
    return c.json(result, 200);
});

export default preferencesRouter;
