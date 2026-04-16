import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { errorHandler } from "../lib/error-handler";
import { timeout } from "./timeout";

describe("timeout middleware", () => {
    test("allows request to complete within limit", async () => {
        const app = new Hono();
        app.use("*", timeout(1000));
        app.get("/fast", (c) => c.json({ success: true }));

        const res = await app.request("/fast");
        expect(res.status).toBe(200);
    });

    test("returns 504 when the request exceeds the limit", async () => {
        const app = new Hono();
        app.onError(errorHandler);
        app.use("*", timeout(100));
        app.get("/slow", async (c) => {
            await new Promise((resolve) => setTimeout(resolve, 500));
            return c.json({ success: true });
        });

        const res = await app.request("/slow");
        const body = (await res.json()) as any;

        expect(res.status).toBe(504);
        expect(body.code).toBe("GATEWAY_TIMEOUT");
    });
});
