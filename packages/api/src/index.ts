import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from '@repo/auth';
import { corsConfig } from '@repo/config';
import { requestId, errorHandler, timeout } from '@repo/observability';
import devices from './routes/devices';
import shifts from './routes/shifts';
import preferences from './routes/preferences';
import managerPreferences from './routes/manager-preferences';

import { db } from '@repo/database';
import { member } from '@repo/database/schema';
import { eq, and } from 'drizzle-orm';

const app = new Hono<{
    Variables: {
        user: typeof auth.$Infer.Session.user | null;
        session: typeof auth.$Infer.Session.session | null
    };
}>();

// Global Middleware
app.use('*', requestId());
app.use('*', timeout(30000));
app.use('*', cors(corsConfig));
app.onError((err, c) => errorHandler(err, c));

// Auth & Session Middleware
app.use('*', async (c, next) => {
    if (c.req.path === '/health' || c.req.path.startsWith('/api/auth')) {
        await next();
        return;
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // [SEC-001] Multi-Tenancy Identity Audit
    // Verify userId belongs to x-org-id if provided
    const orgId = c.req.header('x-org-id');
    if (orgId) {
        // Optimization: In a real production app, cache this membership in Redis or the Session token.
        // For now, we query DB to ensure "No exceptions" strictness.
        const membership = await db.query.member.findFirst({
            where: and(
                eq(member.userId, session.user.id),
                eq(member.organizationId, orgId)
            ),
            columns: { id: true }
        });

        if (!membership) {
            console.warn(`[SEC-AUDIT] User ${session.user.id} attempted to access Org ${orgId} without membership.`);
            return c.json({ error: 'Forbidden: You are not a member of this organization' }, 403);
        }
    }

    c.set('user', session.user);
    c.set('session', session.session);
    await next();
});

// Health Check
app.get('/health', (c) => c.text('OK'));

// Routes
app.route('/devices', devices);
app.route('/shifts', shifts);
app.route('/preferences', preferences);
app.route('/manager-preferences', managerPreferences);

const port = process.env.PORT || 4006;
console.log(`🚀 API Service running on port ${port}`);

export default {
    port,
    fetch: app.fetch,
};
