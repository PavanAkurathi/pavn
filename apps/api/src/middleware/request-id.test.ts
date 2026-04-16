import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { requestId } from "./request-id";

describe("requestId middleware", () => {
    test("adds X-Request-ID header", async () => {
        const app = new Hono();
        app.use("*", requestId());
        app.get("/", (c) => c.text("ok"));

        const res = await app.request("/");
        expect(res.headers.get("x-request-id")).toBeDefined();
        expect(res.headers.get("x-request-id")?.length).toBeGreaterThan(0);
    });
});
