import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";

// The limiter persists counts in the background; nothing here needs a database.
mock.module("@repo/database", () => ({
    db: { insert: () => ({ values: () => ({ onConflictDoUpdate: () => Promise.resolve() }) }) },
}));

const { rateLimit, RATE_LIMITS, MAX_CACHE_ENTRIES, cleanupRateLimitCache, rateLimitCacheSize } = await import("./rate-limit");

const env = process.env.NODE_ENV;
beforeAll(() => {
    process.env.NODE_ENV = "production"; // the limiter is off outside production
});
afterAll(() => {
    process.env.NODE_ENV = env;
});

const from = (ip: string) => ({ headers: { "x-real-ip": ip } });

describe("auth attempt limit", () => {
    test("counts each IP separately, so one caller can't lock everyone out", async () => {
        const app = new Hono();
        app.use("/api/auth/sign-in/*", rateLimit(RATE_LIMITS.auth));
        app.post("/api/auth/sign-in/email", (c) => c.text("ok"));

        for (let i = 0; i < RATE_LIMITS.auth.maxRequests; i++) {
            expect((await app.request("/api/auth/sign-in/email", { method: "POST", ...from("203.0.113.1") })).status).toBe(200);
        }
        expect((await app.request("/api/auth/sign-in/email", { method: "POST", ...from("203.0.113.1") })).status).toBe(429);
        expect((await app.request("/api/auth/sign-in/email", { method: "POST", ...from("203.0.113.2") })).status).toBe(200);
    });
});

describe("general limit", () => {
    test("anonymous callers are keyed by IP, not one shared bucket", async () => {
        const app = new Hono();
        app.use("/organizations/*", rateLimit({ windowMs: 60_000, maxRequests: 2 }));
        app.get("/organizations/default", (c) => c.text("ok"));

        const hit = (ip: string) => app.request("/organizations/default", from(ip));
        expect((await hit("198.51.100.1")).status).toBe(200);
        expect((await hit("198.51.100.1")).status).toBe(200);
        expect((await hit("198.51.100.1")).status).toBe(429);
        expect((await hit("198.51.100.2")).status).toBe(200);
    });
});

describe("worker lookups", () => {
    test("guessing invite codes shares one budget, however the code in the URL changes", async () => {
        const app = new Hono();
        app.use("/worker/auth/*", rateLimit(RATE_LIMITS.workerLookup));
        app.get("/worker/auth/invite/:code", (c) => c.text("nope", 404));

        for (let i = 0; i < RATE_LIMITS.workerLookup.maxRequests; i++) {
            expect((await app.request(`/worker/auth/invite/CODE${i}`, from("192.0.2.7"))).status).toBe(404);
        }
        expect((await app.request("/worker/auth/invite/ANOTHER", from("192.0.2.7"))).status).toBe(429);
        // Someone else is unaffected.
        expect((await app.request("/worker/auth/invite/ANOTHER", from("192.0.2.8"))).status).toBe(404);
    });
});

describe("memory", () => {
    test("a caller who varies the path cannot grow the cache past its ceiling", async () => {
        cleanupRateLimitCache();
        const app = new Hono();
        app.use("/shifts/*", rateLimit({ windowMs: 60_000, maxRequests: 1000 }));
        app.get("/shifts/:id", (c) => c.text("ok"));

        // One more than the ceiling, each on a path nobody has used.
        for (let i = 0; i <= MAX_CACHE_ENTRIES; i++) {
            await app.request(`/shifts/id-${i}`, from("198.51.100.9"));
        }

        expect(rateLimitCacheSize()).toBeLessThanOrEqual(MAX_CACHE_ENTRIES);
        // And it still works afterwards.
        expect((await app.request("/shifts/probe", from("198.51.100.9"))).status).toBe(200);
    }, 60_000);
});
