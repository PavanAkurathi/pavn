import { Hono } from 'hono';
import { db } from '@repo/database';
import { deviceToken } from '@repo/database/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import Expo from 'expo-server-sdk';
import { auth } from '@repo/auth';

const devices = new Hono<{
    Variables: {
        user: typeof auth.$Infer.Session.user
    }
}>();

const RegisterSchema = z.object({
    pushToken: z.string().min(10),
    platform: z.enum(['ios', 'android', 'web']),
    deviceName: z.string().optional(),
    appVersion: z.string().optional(),
    osVersion: z.string().optional(),
});

// Register device token
devices.post('/register', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();

    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
    }

    const { pushToken, platform, deviceName, appVersion, osVersion } = parsed.data;

    // Validate Expo token format
    if (!Expo.isExpoPushToken(pushToken)) {
        return c.json({ error: 'Invalid push token format' }, 400);
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

    return c.json({ success: true });
});

// List user's devices
devices.get('/', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

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

    return c.json({ devices: tokens });
});

// Unregister device
devices.delete('/:tokenId', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const tokenId = c.req.param('tokenId');

    const result = await db.update(deviceToken)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(
            eq(deviceToken.id, tokenId),
            eq(deviceToken.userId, user.id)
        ))
        .returning({ id: deviceToken.id });

    if (result.length === 0) {
        return c.json({ error: 'Device not found' }, 404);
    }

    return c.json({ success: true });
});

export default devices;
