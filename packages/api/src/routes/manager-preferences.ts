import { Hono } from 'hono';
import { db } from '@repo/database';
import { managerNotificationPreferences } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@repo/auth';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const managerPreferences = new Hono<{
    Variables: {
        user: typeof auth.$Infer.Session.user
    }
}>();

const UpdatePreferencesSchema = z.object({
    clockInAlertsEnabled: z.boolean().optional(),
    clockOutAlertsEnabled: z.boolean().optional(),
    shiftScope: z.enum(['all', 'booked_by_me', 'onsite_contact']).optional(),
    locationScope: z.enum(['all', 'selected']).optional(),
});

// GET /manager-preferences
managerPreferences.get('/', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    let prefs = await db.query.managerNotificationPreferences.findFirst({
        where: eq(managerNotificationPreferences.managerId, user.id)
    });

    if (!prefs) {
        // Defaults
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

    return c.json({ preferences: prefs });
});

// PATCH /manager-preferences
managerPreferences.patch('/', zValidator('json', UpdatePreferencesSchema), async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const data = c.req.valid('json');

    const [updatedPrefs] = await db.insert(managerNotificationPreferences)
        .values({
            managerId: user.id,
            ...data
        })
        .onConflictDoUpdate({
            target: managerNotificationPreferences.managerId,
            set: {
                ...data,
                updatedAt: new Date()
            }
        })
        .returning();

    return c.json({ preferences: updatedPrefs });
});

export default managerPreferences;
