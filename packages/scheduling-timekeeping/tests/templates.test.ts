import { describe, test, expect, mock, beforeEach } from "bun:test";

let templateRow: Record<string, unknown> | undefined;
let existingShifts: unknown[] = [];
let insertedShifts: Record<string, unknown>[] = [];

const mockDb = {
    query: {
        shiftTemplate: { findFirst: mock(() => Promise.resolve(templateRow)) },
        shift: { findMany: mock(() => Promise.resolve(existingShifts)) },
        location: { findFirst: mock(() => Promise.resolve({ id: "loc_1" })) },
    },
    insert: () => ({
        values: (rows: Record<string, unknown>[]) => {
            insertedShifts.push(...(Array.isArray(rows) ? rows : [rows]));
            return Promise.resolve();
        },
    }),
};

mock.module("@repo/database", () => ({ db: mockDb }));

const { applyShiftTemplate } = await import("../src/modules/shifts/templates");

const ORG = "org_1";
const template = (over: Record<string, unknown> = {}) => ({
    id: "tpl_1",
    organizationId: ORG,
    locationId: "loc_1",
    name: "Saturday Night Crew",
    startTime: "18:00",
    endTime: "23:00",
    positions: [
        { roleName: "Loader", headcount: 3 },
        { roleName: "Supervisor", headcount: 1 },
    ],
    location: { id: "loc_1", timezone: "America/New_York" },
    ...over,
});

describe("applyShiftTemplate", () => {
    beforeEach(() => {
        insertedShifts = [];
        existingShifts = [];
        templateRow = template();
    });

    test("creates one draft per position, per day", async () => {
        const result = await applyShiftTemplate("tpl_1", { dates: ["2026-09-05", "2026-09-12"] }, ORG);

        expect(result.created).toBe(4); // 2 positions x 2 days
        expect(result.days).toBe(2);
        expect(insertedShifts.every((s) => s.status === "draft")).toBe(true);
        expect(insertedShifts.map((s) => s.capacityTotal)).toEqual([3, 1, 3, 1]);
    });

    test("places the hours in the location's zone, not the server's", async () => {
        await applyShiftTemplate("tpl_1", { dates: ["2026-09-05"] }, ORG);

        // 18:00 in New York on 5 Sep 2026 is EDT (UTC-4).
        expect((insertedShifts[0]!.startTime as Date).toISOString()).toBe("2026-09-05T22:00:00.000Z");
        expect((insertedShifts[0]!.endTime as Date).toISOString()).toBe("2026-09-06T03:00:00.000Z");
        expect(insertedShifts[0]!.timezone).toBe("America/New_York");
    });

    test("keeps the wall clock across a DST change", async () => {
        // Clocks go back on 1 Nov 2026, so 18:00 local is UTC-5 after it.
        await applyShiftTemplate("tpl_1", { dates: ["2026-10-24", "2026-11-07"] }, ORG);

        expect((insertedShifts[0]!.startTime as Date).toISOString()).toBe("2026-10-24T22:00:00.000Z");
        expect((insertedShifts[2]!.startTime as Date).toISOString()).toBe("2026-11-07T23:00:00.000Z");
    });

    test("carries an overnight shift into the next day", async () => {
        templateRow = template({ startTime: "22:00", endTime: "06:00" });

        await applyShiftTemplate("tpl_1", { dates: ["2026-09-05"] }, ORG);

        expect((insertedShifts[0]!.startTime as Date).toISOString()).toBe("2026-09-06T02:00:00.000Z");
        expect((insertedShifts[0]!.endTime as Date).toISOString()).toBe("2026-09-06T10:00:00.000Z");
    });

    test("skips days that already have shifts, so applying twice does not double the day", async () => {
        existingShifts = [{ id: "shf_x", startTime: new Date("2026-09-05T14:00:00Z") }];

        const result = await applyShiftTemplate("tpl_1", { dates: ["2026-09-05", "2026-09-12"] }, ORG);

        expect(result.skippedDays).toEqual(["2026-09-05"]);
        expect(result.created).toBe(2); // only the 12th
    });

    test("says so when every day picked is already busy", async () => {
        existingShifts = [{ id: "shf_x", startTime: new Date("2026-09-05T14:00:00Z") }];

        const result = await applyShiftTemplate("tpl_1", { dates: ["2026-09-05"] }, ORG);

        expect(result.created).toBe(0);
        expect(result.message).toContain("already has shifts");
    });

    test("refuses a template whose location has no timezone", async () => {
        templateRow = template({ location: { id: "loc_1", timezone: null } });

        await expect(applyShiftTemplate("tpl_1", { dates: ["2026-09-05"] }, ORG)).rejects.toThrow(
            /no timezone/,
        );
    });

    test("404s for a template belonging to another org", async () => {
        templateRow = undefined;

        await expect(applyShiftTemplate("tpl_other", { dates: ["2026-09-05"] }, ORG)).rejects.toThrow(
            /Template not found/,
        );
    });

    test("rejects an empty date list", async () => {
        await expect(applyShiftTemplate("tpl_1", { dates: [] }, ORG)).rejects.toThrow(/Validation failed/);
    });
});
