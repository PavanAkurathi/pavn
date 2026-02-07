
import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { requestId, errorHandler, AppError } from "@repo/observability";

describe.skip("Middleware Verification", () => {
    test("WH-113: Adds X-Request-ID header", async () => {
        const app = new Hono();
        app.use("*", requestId());
        app.get("/", (c) => c.text("ok"));

        const res = await app.request("/");
        expect(res.headers.get("x-request-id")).toBeDefined();
        expect(res.headers.get("x-request-id")?.length).toBeGreaterThan(0);
    });

    test("WH-112: Standardizes AppError response", async () => {
        const app = new Hono();
        app.use("*", requestId());
        app.onError((err, c) => errorHandler(err, c)); // Fix type mismatch if needs cast?

        app.get("/error", () => {
            throw new AppError("Test Error", "TEST_CODE", 400, { foo: "bar" });
        });

        const res = await app.request("/error");
        expect(res.status).toBe(400);

        const body = res as any;
        expect(body.success).toBe(false);
        expect(body.error).toBe("Test Error");
        expect(body.code).toBe("TEST_CODE");
        expect(body.details).toEqual({ foo: "bar" });
        expect(body.requestId).toBeDefined();
    });

    test("WH-112: Catch generic Error as 500", async () => {
        const app = new Hono();
        app.use("*", requestId());
        app.onError((err, c) => errorHandler(err, c));

        app.get("/panic", () => {
            throw new Error("Something exploded");
        });

        const res = await app.request("/panic");
        expect(res.status).toBe(500);
        const body = res as any;
        expect(body.code).toBe("INTERNAL_SERVER_ERROR");
        expect(body.requestId).toBeDefined();
    });
});
