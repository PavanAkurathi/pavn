import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { AppError } from "@repo/observability";
import { errorHandler } from "./error-handler";
import { requestId } from "../middleware/request-id";

describe("errorHandler", () => {
    test("serializes AppError responses", async () => {
        const app = new Hono();
        app.use("*", requestId());
        app.onError((err, c) => errorHandler(err, c));
        app.get("/error", () => {
            throw new AppError("Test Error", "TEST_CODE", 400, { foo: "bar" });
        });

        const res = await app.request("/error");
        const body = (await res.json()) as any;

        expect(res.status).toBe(400);
        expect(body.success).toBe(false);
        expect(body.error).toBe("Test Error");
        expect(body.code).toBe("TEST_CODE");
        expect(body.details).toEqual({ foo: "bar" });
        expect(body.requestId).toBeDefined();
    });

    test("converts generic errors to 500 responses", async () => {
        const app = new Hono();
        app.use("*", requestId());
        app.onError((err, c) => errorHandler(err, c));
        app.get("/panic", () => {
            throw new Error("Something exploded");
        });

        const res = await app.request("/panic");
        const body = (await res.json()) as any;

        expect(res.status).toBe(500);
        expect(body.code).toBe("INTERNAL_SERVER_ERROR");
        expect(body.requestId).toBeDefined();
    });
});
