import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { timeout } from "../src/timeout";
import { errorHandler } from "../src/index";

describe("Timeout Middleware", () => {
    test("allows request to complete within limit", async () => {
        const app = new Hono();
        app.use("*", timeout(1000));
        app.get("/fast", async (c) => {
            return c.json({ success: true });
        });

        const res = await app.request("/fast");
        expect(res.status).toBe(200);
    });

    test("aborts request exceeding limit", async () => {
        const app = new Hono();
        app.onError(errorHandler);
        app.use("*", timeout(100)); // Short timeout for test

        app.get("/slow", async (c) => {
            await new Promise(resolve => setTimeout(resolve, 500));
            return c.json({ success: true });
        });

        const res = await app.request("/slow");
        const data = await res.json() as any;

        expect(res.status).toBe(504);
        expect(data.code).toBe("GATEWAY_TIMEOUT");
    });
});
