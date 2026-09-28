import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";

// The limiter persists counts in the background; nothing here needs a database.
mock.module("@repo/database", () => ({
    db: { insert: () => ({ values: () => ({ onConflictDoUpdate: () => Promise.resolve() }) }) },
}));

const { rateLimit, RATE_LIMITS } = await import("./rate-limit");

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
