import { describe, it, expect, mock } from "bun:test";
import preferences from "../src/routes/preferences";
import { Hono } from "hono";

// Mock the DB
// We need to verify that GET returns defaults if null, and PATCH updates.
const mockDb = {
    insert: mock(() => ({
        values: mock(() => ({
            returning: mock(async () => ([{
                workerId: "test-user",
                nightBeforeEnabled: true
            }])),
            onConflictDoUpdate: mock(() => ({
                returning: mock(async () => ([{
                    workerId: "test-user",
                    nightBeforeEnabled: false // Simulate update
                }]))
            }))
        }))
    })),
    query: {
        workerNotificationPreferences: {
            findFirst: mock(async () => null) // Default to null to test creation logic
        }
    }
};

mock.module("@repo/database", () => ({
    db: mockDb
}));

// Mock Auth Middleware to inject user
// Since we can't easily mock the middleware globally in a sub-router export without mounting it,
// we'll construct a test app that mounts the router and adds the variable.
const app = new Hono<{
    Variables: {
        user: { id: string, email: string }
    }
}>();

app.use('*', async (c, next) => {
    c.set('user', { id: 'test-user', email: 'test@example.com' });
    await next();
});

app.route('/preferences', preferences);

describe("Preferences API", () => {
    it("GET /preferences - should return default preferences if none exist", async () => {
        const res = await app.request('/preferences', {
            method: 'GET'
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.preferences).toBeDefined();
        // The mock returns the inserted default
        expect(data.preferences.nightBeforeEnabled).toBe(true);
        expect(mockDb.insert).toHaveBeenCalled(); // Should have triggered insert default
    });

    it("PATCH /preferences - should update preferences", async () => {
        const res = await app.request('/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nightBeforeEnabled: false })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.preferences.nightBeforeEnabled).toBe(false); // From mock update
    });

    it("PATCH /preferences - should validate input (fail on invalid type)", async () => {
        const res = await app.request('/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nightBeforeEnabled: "invalid-boolean" })
        });

        expect(res.status).toBe(400);
    });
});
