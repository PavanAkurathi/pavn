import { beforeEach, describe, expect, mock, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppError } from "@repo/observability";
import type { AppContext } from "../index";

const week = {
    location: { id: "loc_dt", name: "Downtown Bistro", timezone: "America/New_York" },
    weekStart: "2026-09-27",
    weekStartsOn: 0,
    days: [],
    settings: { overtimePolicy: "weekly_40", scheduleStyle: "steady", openShiftClaimPolicy: "approval" },
    departments: [],
    people: [],
    shifts: [],
    events: [],
    timeOff: [],
    unavailable: [],
    summary: { openSlots: 0, pendingChangeCount: 0, pendingRequestCount: 0 },
};

const mockGetSchedulerWeek = mock((_input: { orgId: string; locationId: string; weekStart?: string }) => Promise.resolve(week));

mock.module("@repo/scheduling-timekeeping", () => ({ getSchedulerWeek: mockGetSchedulerWeek }));

const { schedulerRouter } = await import("./scheduler");
const { errorHandler } = await import("../lib/error-handler");

function appAs(role: string) {
    const app = new OpenAPIHono<AppContext>();
    app.use("*", async (c, next) => {
        c.set("userRole", role as never);
        c.set("orgId", "org_1");
        c.set("user", { id: "user_1" } as never);
        await next();
    });
    app.route("/scheduler", schedulerRouter);
    app.onError((err, c) => errorHandler(err, c));
    return app;
}

describe("GET /scheduler/week", () => {
    beforeEach(() => {
        mockGetSchedulerWeek.mockClear();
        mockGetSchedulerWeek.mockImplementation(() => Promise.resolve(week));
    });

    test("returns the week for the caller's organization", async () => {
        const response = await appAs("manager").request("/scheduler/week?locationId=loc_dt&weekStart=2026-09-30");
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(week);
        expect(mockGetSchedulerWeek).toHaveBeenCalledWith({ orgId: "org_1", locationId: "loc_dt", weekStart: "2026-09-30" });
    });

    test("is for managers only", async () => {
        const response = await appAs("member").request("/scheduler/week?locationId=loc_dt");
        expect(response.status).toBe(403);
        expect(mockGetSchedulerWeek).not.toHaveBeenCalled();
    });

    test("rejects a missing location or a malformed date before reaching the service", async () => {
        const app = appAs("admin");
        expect((await app.request("/scheduler/week")).status).toBe(400);
        expect((await app.request("/scheduler/week?locationId=loc_dt&weekStart=2026-9-3")).status).toBe(400);
        expect(mockGetSchedulerWeek).not.toHaveBeenCalled();
    });

    test("passes through a location outside the organization as 404", async () => {
        mockGetSchedulerWeek.mockImplementation(() =>
            Promise.reject(new AppError("Location not found", "LOCATION_NOT_FOUND", 404)),
        );
        const response = await appAs("owner").request("/scheduler/week?locationId=loc_other");
        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({ code: "LOCATION_NOT_FOUND" });
    });
});
