/**
 * @fileoverview Manager Preferences Routes
 * @module apps/api/routes/manager-preferences
 * 
 * Handles manager notification preferences and settings.
 */

import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import {
    ManagerPreferencesResponseSchema,
    UpdateManagerPreferencesSchema,
} from "@repo/contracts/preferences";
import {
    getManagerPreferences,
    updateManagerPreferences,
} from "@repo/notifications";
import type { AppContext } from "../index";

export const managerPreferencesRouter = new OpenAPIHono<AppContext>();

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
            content: { 'application/json': { schema: ManagerPreferencesResponseSchema } },
            description: 'Manager preferences'
        },
        401: { description: 'Unauthorized' }
    }
});

managerPreferencesRouter.openapi(getPreferencesRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const prefs = await getManagerPreferences(user.id);

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
            content: { 'application/json': { schema: ManagerPreferencesResponseSchema } },
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

    const updatedPrefs = await updateManagerPreferences(user.id, parsed.data);

    return c.json({ preferences: updatedPrefs } as any, 200);
});

export default managerPreferencesRouter;
