import { beforeEach, describe, expect, mock, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import type { AppContext } from "../index";

const mockGetWorkerPhoneAccess = mock(() => Promise.resolve({
    eligible: true,
    organizationCount: 2,
    existingAccount: false,
}));

const noop = mock(() => Promise.resolve([]));
const calls: { fn: string; args: unknown[] }[] = [];
const record = (fn: string, result: unknown) => (...args: unknown[]) => {
    calls.push({ fn, args });
    return Promise.resolve(result);
};
const noopObject = mock(() => Promise.resolve({}));

mock.module("@repo/auth", () => ({
    getWorkerPhoneAccess: mockGetWorkerPhoneAccess,
}));

// These factories replace the module wholesale, so every named import that
// worker.ts pulls in has to be listed here or the import throws at load time.
mock.module("@repo/scheduling-timekeeping", () => ({
    getWorkerShifts: noop,
    getWorkerShiftById: noopObject,
    getWorkerAllShifts: noopObject,
    UpcomingShiftsResponseSchema: z.array(z.any()),
    listOpenShifts: record("listOpenShifts", { shifts: [] }),
    listWorkerRequests: record("listWorkerRequests", { requests: [] }),
    createShiftRequest: record("createShiftRequest", { id: "req_1", status: "pending_manager", message: "Sent to your manager." }),
    actOnRequest: record("actOnRequest", { id: "req_1", status: "cancelled", message: "Cancelled." }),
    listSwapCandidates: record("listSwapCandidates", { people: [] }),
    createTimeOff: record("createTimeOff", { ids: ["tor_1"], message: "Sent to your manager." }),
}));

mock.module("@repo/gig-workers", () => ({
    setAvailability: noopObject,
    getAvailability: noopObject,
    getWorkerOrganizations: noop,
    updateWorkerProfile: noopObject,
    AvailabilityResponseSchema: z.any(),
    WorkerSchema: z.any(),
}));

mock.module("@repo/geofence", () => ({
    requestCorrection: noopObject,
    getWorkerCorrections: noop,
    CorrectionRequestSchema: z.any(),
}));

const { workerRouter } = await import("./worker");

const app = new OpenAPIHono<AppContext>();
app.route("/worker", workerRouter);

describe("worker auth routes", () => {
    beforeEach(() => {
        mockGetWorkerPhoneAccess.mockClear();
    });

    test("POST /worker/auth/eligibility returns phone access status", async () => {
        const response = await app.request("/worker/auth/eligibility", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ phoneNumber: "+15550001234" }),
        });

        expect(response.status).toBe(200);
        expect(mockGetWorkerPhoneAccess).toHaveBeenCalledWith("+15550001234");
        expect(await response.json()).toEqual({
            eligible: true,
            organizationCount: 2,
            existingAccount: false,
        });
    });

    test("POST /worker/auth/eligibility rejects invalid payloads", async () => {
        const response = await app.request("/worker/auth/eligibility", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
        });

        expect(response.status).toBe(400);
        expect(mockGetWorkerPhoneAccess).not.toHaveBeenCalled();
    });
});

describe("worker requests", () => {
    const signedIn = new OpenAPIHono<AppContext>();
    signedIn.use("*", async (c, next) => {
        c.set("user", { id: "usr_ana" } as never);
        c.set("orgId", "");
        await next();
    });
    signedIn.route("/worker", workerRouter);

    beforeEach(() => {
        calls.length = 0;
    });

    test("open shifts are the signed-in worker's", async () => {
        const response = await signedIn.request("/worker/open-shifts");
        expect(response.status).toBe(200);
        expect(calls).toEqual([{ fn: "listOpenShifts", args: [{ workerId: "usr_ana" }] }]);
    });

    test("a claim goes through with the worker's id", async () => {
        const response = await signedIn.request("/worker/requests", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "claim", shiftId: "shf_1" }),
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ status: "pending_manager" });
        expect(calls[0]).toEqual({ fn: "createShiftRequest", args: [{ workerId: "usr_ana", body: { type: "claim", shiftId: "shf_1" } }] });
    });

    test("a swap needs someone to swap with", async () => {
        const response = await signedIn.request("/worker/requests", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "swap", shiftId: "shf_1" }),
        });
        expect(response.status).toBe(400);
        expect(calls).toHaveLength(0);
    });

    test("accept, decline and cancel are the only actions", async () => {
        expect((await signedIn.request("/worker/requests/req_1/cancel", { method: "POST" })).status).toBe(200);
        expect(calls[0]).toEqual({ fn: "actOnRequest", args: [{ workerId: "usr_ana", id: "req_1", action: "cancel" }] });
        expect((await signedIn.request("/worker/requests/req_1/approve", { method: "POST" })).status).toBe(400);
    });

    test("time off is validated before it reaches the use case", async () => {
        const bad = await signedIn.request("/worker/time-off", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ allDay: true, startDate: "2027-02-05", endDate: "2027-02-03" }),
        });
        expect(bad.status).toBe(400);
        const good = await signedIn.request("/worker/time-off", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ allDay: true, startDate: "2027-02-03", endDate: "2027-02-05", reason: "Wedding" }),
        });
        expect(good.status).toBe(200);
        expect(calls.at(-1)?.fn).toBe("createTimeOff");
    });

    test("signed-out callers are turned away", async () => {
        const anonymous = new OpenAPIHono<AppContext>();
        anonymous.route("/worker", workerRouter);
        expect((await anonymous.request("/worker/requests")).status).toBe(401);
    });
});
