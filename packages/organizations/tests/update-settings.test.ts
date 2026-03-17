import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockReturning = mock(() => Promise.resolve([{ id: "org_1" }]));
const mockWhere = mock(() => ({ returning: mockReturning }));
const mockSet = mock(() => ({ where: mockWhere }));
const mockUpdate = mock(() => ({ set: mockSet }));

mock.module("@repo/database", () => ({
    db: {
        update: mockUpdate,
    },
}));

mock.module("@repo/database/schema", () => ({
    member: { id: "id", organizationId: "organizationId" },
    organization: { id: "id" },
}));

mock.module("drizzle-orm", () => ({
    eq: (...args: unknown[]) => ({ op: "eq", args }),
}));

mock.module("@repo/observability", () => ({
    AppError: class extends Error {
        constructor(
            public message: string,
            public code: string,
            public statusCode: number,
            public details?: unknown
        ) {
            super(message);
            this.name = "AppError";
        }
    },
}));

describe("updateSettings", () => {
    beforeEach(() => {
        mockUpdate.mockClear();
        mockSet.mockClear();
        mockWhere.mockClear();
        mockReturning.mockClear();
    });

    test("accepts only validated org settings", async () => {
        const { updateSettings } = await import("../src/modules/settings/update-settings");

        await updateSettings(
            {
                timezone: "America/New_York",
                earlyClockInBufferMinutes: 45,
                regionalOvertimePolicy: "weekly_40",
                attendanceVerificationPolicy: "soft_geofence",
            },
            "org_1"
        );

        expect(mockSet).toHaveBeenCalledWith({
            timezone: "America/New_York",
            earlyClockInBufferMinutes: 45,
            regionalOvertimePolicy: "weekly_40",
            attendanceVerificationPolicy: "soft_geofence",
        });
    });

    test("rejects invalid timezone and unknown fields", async () => {
        const { updateSettings } = await import("../src/modules/settings/update-settings");

        await expect(updateSettings(
            {
                timezone: "Mars/Phobos",
                metadata: "oops",
            },
            "org_1"
        )).rejects.toMatchObject({
            name: "AppError",
            code: "VALIDATION_ERROR",
            statusCode: 400,
        });

        expect(mockUpdate).not.toHaveBeenCalled();
    });

    test("rejects invalid attendance verification policy", async () => {
        const { updateSettings } = await import("../src/modules/settings/update-settings");

        await expect(updateSettings(
            {
                attendanceVerificationPolicy: "sometimes_geofence",
            },
            "org_1"
        )).rejects.toMatchObject({
            name: "AppError",
            code: "VALIDATION_ERROR",
            statusCode: 400,
        });
    });
});
