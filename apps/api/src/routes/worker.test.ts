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
const noopObject = mock(() => Promise.resolve({}));

mock.module("@repo/auth", () => ({
    getWorkerPhoneAccess: mockGetWorkerPhoneAccess,
}));

mock.module("@repo/shifts-service", () => ({
    getWorkerShifts: noop,
    getWorkerAllShifts: noopObject,
    setAvailability: noopObject,
    getAvailability: noopObject,
    UpcomingShiftsResponseSchema: z.array(z.any()),
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
