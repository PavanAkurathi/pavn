/**
 * @fileoverview Device Registration Routes
 * @module apps/api/routes/devices
 * 
 * Handles mobile device registration for push notifications.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "@repo/database";
import { deviceToken } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import Expo from "expo-server-sdk";
import type { AppContext } from "../index";

export const devicesRouter = new OpenAPIHono<AppContext>();

// =============================================================================
// SCHEMAS
// =============================================================================

const DeviceTokenSchema = z.object({
    id: z.string(),
    platform: z.enum(['ios', 'android', 'web']),
    deviceName: z.string().nullable().optional(),
    appVersion: z.string().nullable().optional(),
    lastUsedAt: z.date().nullable().optional(), // In OpenAPI date-time string
    createdAt: z.date(),
});

const RegisterSchema = z.object({
    pushToken: z.string().min(10),
    platform: z.enum(['ios', 'android', 'web']),
    deviceName: z.string().optional(),
    appVersion: z.string().optional(),
    osVersion: z.string().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

const registerRoute = createRoute({
    method: 'post',
    path: '/register',
    summary: 'Register Device',
    description: 'Register a device push token.',
    request: {
        body: {
            content: {
                'application/json': { schema: RegisterSchema }
            }
        }
    },
    responses: {
        200: {
            content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
            description: 'Device registered'
        },
        400: { description: 'Invalid token' },
        401: { description: 'Unauthorized' }
    }
});

devicesRouter.openapi(registerRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    // Validate schema manually or rely on OpenAPI validator (OpenAPIHono validates if configured, but let's trust safeParse here if needed, actually OpenAPIHono validation middleware usually handles it if we set it up. But let's act safely).
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: "Invalid request" }, 400);
    }

    const { pushToken, platform, deviceName, appVersion, osVersion } = parsed.data;

    // Validate Expo token format
    if (!Expo.isExpoPushToken(pushToken)) {
        return c.json({ error: "Invalid push token format" }, 400);
    }

    const now = new Date();

    // Upsert token
    await db.insert(deviceToken)
        .values({
            id: nanoid(),
            userId: user.id,
            pushToken,
            platform,
            deviceName,
            appVersion,
            osVersion,
            isActive: true,
            lastUsedAt: now,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [deviceToken.userId, deviceToken.pushToken],
            set: {
                isActive: true,
                lastUsedAt: now,
                deviceName,
                appVersion,
                osVersion,
                updatedAt: now,
            },
        });

    return c.json({ success: true }, 200);
});

const listDevicesRoute = createRoute({
    method: 'get',
    path: '/',
    summary: 'List Devices',
    description: 'List active devices for the user.',
    responses: {
        200: {
            content: { 'application/json': { schema: z.object({ devices: z.array(z.any()) }) } }, // Simplify schema for now
            description: 'List of devices'
        },
        401: { description: 'Unauthorized' }
    }
});

devicesRouter.openapi(listDevicesRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const tokens = await db.query.deviceToken.findMany({
        where: and(
            eq(deviceToken.userId, user.id),
            eq(deviceToken.isActive, true)
        ),
        columns: {
            id: true,
            platform: true,
            deviceName: true,
            appVersion: true,
            lastUsedAt: true,
            createdAt: true,
        },
    });

    return c.json({ devices: tokens }, 200);
});

const unregisterRoute = createRoute({
    method: 'delete',
    path: '/{tokenId}',
    summary: 'Unregister Device',
    description: 'Deactivate a device token.',
    request: { params: z.object({ tokenId: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Device unregistered' },
        404: { description: 'Device not found' },
        401: { description: 'Unauthorized' }
    }
});

devicesRouter.openapi(unregisterRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const tokenId = c.req.param("tokenId");

    const result = await db.update(deviceToken)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(
            eq(deviceToken.id, tokenId),
            eq(deviceToken.userId, user.id)
        ))
        .returning({ id: deviceToken.id });

    if (result.length === 0) {
        return c.json({ error: "Device not found" }, 404);
    }

    return c.json({ success: true }, 200);
});

export default devicesRouter;
