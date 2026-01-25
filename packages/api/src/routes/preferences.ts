import { Hono } from 'hono';
import { db } from '@repo/database';
import { workerNotificationPreferences } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@repo/auth';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const preferences = new Hono<{
    Variables: {
        user: typeof auth.$Infer.Session.user
    }
}>();

// Schema for updating preferences
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

// GET /preferences
preferences.get('/', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

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

    return c.json({ preferences: prefs });
});

// PATCH /preferences
preferences.patch('/', zValidator('json', UpdatePreferencesSchema), async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const data = c.req.valid('json');

    // Ensure record exists before update (or upsert)
    // Upsert is cleaner here to handle race conditions or missing rows
    const [updatedPrefs] = await db.insert(workerNotificationPreferences)
        .values({
            workerId: user.id,
            ...data
        })
        .onConflictDoUpdate({
            target: workerNotificationPreferences.workerId,
            set: {
                ...data,
                updatedAt: new Date()
            }
        })
        .returning();

    return c.json({ preferences: updatedPrefs });
});

export default preferences;
