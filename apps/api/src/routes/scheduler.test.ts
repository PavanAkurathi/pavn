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

const settings = {
    businessType: "restaurant",
    scheduleStyle: "steady",
    openShiftClaimPolicy: "approval",
    swapApprovalRequired: true,
    weekStartsOn: 0,
    overtimePolicy: "weekly_40",
    departments: [{ id: "dep_1", name: "Kitchen", roles: ["Line Cook"], sortOrder: 0 }],
};
const settingsCalls: { fn: string; args: unknown[] }[] = [];
const record = (fn: string, result: unknown) => (...args: unknown[]) => {
    settingsCalls.push({ fn, args });
    return Promise.resolve(result);
};

mock.module("@repo/scheduling-timekeeping", () => ({
    getSchedulerWeek: mockGetSchedulerWeek,
    getSchedulingSettings: record("getSchedulingSettings", settings),
    updateSchedulingSettings: record("updateSchedulingSettings", settings),
    applySchedulingSetup: record("applySchedulingSetup", settings),
    listDepartments: record("listDepartments", settings.departments),
    createDepartment: record("createDepartment", settings.departments[0]),
    updateDepartment: record("updateDepartment", settings.departments[0]),
    deleteDepartment: record("deleteDepartment", { id: "dep_1" }),
    applySchedulerChanges: record("applySchedulerChanges", { undo: [], overridden: [] }),
    previewSchedulerPublish: record("previewSchedulerPublish", { newShifts: 1 }),
    publishSchedulerWeek: record("publishSchedulerWeek", { newShifts: 1, publishedAt: "2027-02-01T00:00:00.000Z" }),
    listManagerRequests: record("listManagerRequests", { requests: [], pendingCount: 0 }),
    getRequestsSummary: record("getRequestsSummary", { pending: 2 }),
    decideRequest: (input: { id: string; decision: string; body: { force?: boolean } }) => {
        settingsCalls.push({ fn: "decideRequest", args: [input] });
        if (input.id === "req_conflict" && !input.body.force) {
            return Promise.reject(new AppError("Ana: Already on Tue 4p–11p Server", "SCHEDULE_CONFLICT", 409, { conflicts: ["Already on Tue 4p–11p Server"] }));
        }
        return Promise.resolve({ id: input.id, status: input.decision === "approve" ? "approved" : "declined" });
    },
    discardSchedulerWeek: record("discardSchedulerWeek", { deletedDrafts: 1, revertedShifts: 0, revertedAssignments: 0 }),
    listShiftTemplates: record("listShiftTemplates", [
        { id: "tpl_1", name: "Dinner", locationId: "loc_dt", locationName: "Downtown", startTime: "16:00", endTime: "23:00", positions: [{ roleName: "Server", headcount: 3 }], headcount: 3 },
        { id: "tpl_2", name: "Brunch", locationId: "loc_rv", locationName: "Riverside", startTime: "09:00", endTime: "14:00", positions: [], headcount: 0 },
    ]),
}));

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

describe("scheduling settings and departments", () => {
    beforeEach(() => {
        settingsCalls.length = 0;
    });

    const send = (role: string, method: string, path: string, body?: unknown) =>
        appAs(role).request(path, {
            method,
            headers: { "content-type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
        });

    test("managers can read settings and departments", async () => {
        expect((await send("manager", "GET", "/scheduler/settings")).status).toBe(200);
        expect((await send("manager", "GET", "/scheduler/departments")).status).toBe(200);
        expect(settingsCalls.map((c) => c.args)).toEqual([["org_1"], ["org_1"]]);
    });

    test("only admins change them", async () => {
        const denied = await send("manager", "PATCH", "/scheduler/settings", { weekStartsOn: 1 });
        expect(denied.status).toBe(403);
        expect(await denied.json()).toMatchObject({ code: "ADMIN_REQUIRED" });
        expect((await send("manager", "POST", "/scheduler/departments", { name: "Bar" })).status).toBe(403);
        expect((await send("member", "GET", "/scheduler/settings")).status).toBe(403);
        expect(settingsCalls).toHaveLength(0);

        expect((await send("owner", "PATCH", "/scheduler/settings", { weekStartsOn: 1 })).status).toBe(200);
        expect(settingsCalls[0]).toEqual({ fn: "updateSchedulingSettings", args: ["org_1", { weekStartsOn: 1 }] });
    });

    test("setup answers are checked before they reach the service", async () => {
        expect((await send("admin", "POST", "/scheduler/setup", { businessType: "zoo" })).status).toBe(400);
        expect(settingsCalls).toHaveLength(0);

        const answers = { businessType: "events", scheduleStyle: "events", openShiftClaimPolicy: "auto" };
        const ok = await send("admin", "POST", "/scheduler/setup", answers);
        expect(ok.status).toBe(200);
        expect(settingsCalls[0]).toEqual({ fn: "applySchedulingSetup", args: ["org_1", answers] });
    });

    test("departments are created, changed and deleted by id", async () => {
        expect((await send("admin", "POST", "/scheduler/departments", { name: "Bar", roles: ["Bartender"] })).status).toBe(200);
        expect((await send("admin", "PATCH", "/scheduler/departments/dep_1", { sortOrder: 2 })).status).toBe(200);
        expect((await send("admin", "DELETE", "/scheduler/departments/dep_1")).status).toBe(200);
        expect(settingsCalls.map((c) => [c.fn, c.args])).toEqual([
            ["createDepartment", ["org_1", { name: "Bar", roles: ["Bartender"] }]],
            ["updateDepartment", ["org_1", "dep_1", { sortOrder: 2 }]],
            ["deleteDepartment", ["org_1", "dep_1"]],
        ]);
    });

    test("an empty department change is rejected", async () => {
        expect((await send("admin", "PATCH", "/scheduler/departments/dep_1", {})).status).toBe(400);
    });
});

describe("editing", () => {
    beforeEach(() => {
        settingsCalls.length = 0;
    });

    const post = (role: string, path: string, body: unknown) =>
        appAs(role).request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    const create = {
        op: "create",
        shiftId: "shf_0123456789abcdef",
        shift: { locationId: "loc_dt", localDate: "2027-02-03", startLocal: "16:00", endLocal: "23:00", role: "Server" },
    };

    test("a batch reaches the engine with the acting manager, defaults filled in", async () => {
        const response = await post("manager", "/scheduler/changes", { changes: [create] });
        expect(response.status).toBe(200);
        expect(settingsCalls[0]!.fn).toBe("applySchedulerChanges");
        expect(settingsCalls[0]!.args[0]).toMatchObject({
            orgId: "org_1",
            actorId: "user_1",
            body: { force: false, changes: [{ ...create, shift: { ...create.shift, capacity: 1 }, assignees: [] }] },
        });
    });

    test("malformed batches never reach the engine", async () => {
        expect((await post("manager", "/scheduler/changes", { changes: [] })).status).toBe(400);
        expect((await post("manager", "/scheduler/changes", { changes: [{ ...create, shiftId: "bad" }] })).status).toBe(400);
        expect((await post("member", "/scheduler/changes", { changes: [create] })).status).toBe(403);
        expect(settingsCalls).toHaveLength(0);
    });

    test("discard is scoped to a location and week", async () => {
        const response = await post("manager", "/scheduler/week/discard", { locationId: "loc_dt", weekStart: "2027-02-03" });
        expect(await response.json()).toEqual({ deletedDrafts: 1, revertedShifts: 0, revertedAssignments: 0 });
        expect(settingsCalls[0]!.args[0]).toEqual({ orgId: "org_1", body: { locationId: "loc_dt", weekStart: "2027-02-03" } });
    });

    test("templates are listed for the location in view", async () => {
        const response = await appAs("manager").request("/scheduler/templates?locationId=loc_dt");
        expect((await response.json()).map((t: { id: string }) => t.id)).toEqual(["tpl_1"]);
    });
});

describe("publishing", () => {
    beforeEach(() => {
        settingsCalls.length = 0;
    });

    test("the preview reads one week at one location", async () => {
        const response = await appAs("manager").request("/scheduler/week/publish-preview?locationId=loc_dt&weekStart=2027-02-03");
        expect(response.status).toBe(200);
        expect(settingsCalls[0]).toEqual({ fn: "previewSchedulerPublish", args: [{ orgId: "org_1", body: { locationId: "loc_dt", weekStart: "2027-02-03" } }] });
    });

    test("publishing passes the acting manager and defaults force to false", async () => {
        const response = await appAs("manager").request("/scheduler/week/publish", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ locationId: "loc_dt", weekStart: "2027-02-03" }),
        });
        expect(response.status).toBe(200);
        expect(settingsCalls[0]!.args[0]).toEqual({
            orgId: "org_1",
            actorId: "user_1",
            body: { locationId: "loc_dt", weekStart: "2027-02-03", force: false },
        });
    });

    test("staff can't publish", async () => {
        const response = await appAs("member").request("/scheduler/week/publish", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ locationId: "loc_dt", weekStart: "2027-02-03" }),
        });
        expect(response.status).toBe(403);
    });
});

describe("/scheduler/requests", () => {
    beforeEach(() => {
        settingsCalls.length = 0;
    });

    test("lists and counts for the caller's organization, managers only", async () => {
        const list = await appAs("manager").request("/scheduler/requests?view=recent");
        expect(list.status).toBe(200);
        expect(settingsCalls[0]).toEqual({ fn: "listManagerRequests", args: [{ orgId: "org_1", query: { view: "recent" } }] });
        expect(await (await appAs("manager").request("/scheduler/requests/summary")).json()).toEqual({ pending: 2 });
        expect((await appAs("member").request("/scheduler/requests")).status).toBe(403);
    });

    test("approve and decline pass who decided", async () => {
        const post = (path: string, body: unknown) =>
            appAs("manager").request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        expect(await (await post("/scheduler/requests/req_abc/approve", {})).json()).toEqual({ id: "req_abc", status: "approved" });
        expect(await (await post("/scheduler/requests/tor_abc/decline", { note: "Short-staffed that week" })).json()).toEqual({
            id: "tor_abc",
            status: "declined",
        });
        expect(settingsCalls.map((c) => c.args[0])).toEqual([
            { orgId: "org_1", actorId: "user_1", id: "req_abc", decision: "approve", body: { force: false } },
            { orgId: "org_1", actorId: "user_1", id: "tor_abc", decision: "decline", body: { note: "Short-staffed that week", force: false } },
        ]);
    });

    test("a conflict comes back as a 409 with the reasons, and force gets past it", async () => {
        const post = (body: unknown) =>
            appAs("manager").request("/scheduler/requests/req_conflict/approve", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            });
        const blocked = await post({});
        expect(blocked.status).toBe(409);
        expect(JSON.stringify(await blocked.json())).toContain("Already on Tue 4p–11p Server");
        expect((await post({ force: true })).status).toBe(200);
    });

    test("unknown request ids are rejected before any work", async () => {
        const response = await appAs("manager").request("/scheduler/requests/shf_1/approve", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
        });
        expect(response.status).toBe(400);
        expect(settingsCalls).toHaveLength(0);
    });
});
