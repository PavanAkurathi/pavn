import { describe, expect, test } from "bun:test";
import { SchedulerChangesInputSchema } from "@repo/contracts/scheduler";
import { defaultBreakMinutes, shiftInstants } from "../src/modules/scheduler/changes";

describe("shiftInstants", () => {
    test("reads times as the location's wall clock", () => {
        const { start, end } = shiftInstants("2027-02-03", "09:00", "17:30", "America/New_York");
        expect(start.toISOString()).toBe("2027-02-03T14:00:00.000Z");
        expect(end.toISOString()).toBe("2027-02-03T22:30:00.000Z");
    });

    test("an end before the start is the next morning", () => {
        const { end } = shiftInstants("2027-02-03", "22:00", "02:00", "America/New_York");
        expect(end.toISOString()).toBe("2027-02-04T07:00:00.000Z");
    });

    test("keeps wall-clock hours across a DST change", () => {
        // US clocks spring forward on Sun 14 Mar 2027; 10p–6a spans it and is 7 real hours.
        const { start, end } = shiftInstants("2027-03-13", "22:00", "06:00", "America/New_York");
        expect((end.getTime() - start.getTime()) / 3_600_000).toBe(7);
    });

    test("refuses a shift that starts and ends at the same time", () => {
        expect(() => shiftInstants("2027-02-03", "09:00", "09:00", "America/New_York")).toThrow();
    });
});

describe("defaultBreakMinutes", () => {
    test("30 minutes only on shifts over six hours", () => {
        const at = (h: number) => new Date(Date.UTC(2027, 1, 3, h));
        expect(defaultBreakMinutes(at(9), at(15))).toBe(0);
        expect(defaultBreakMinutes(at(9), at(16))).toBe(30);
    });
});

describe("SchedulerChangesInputSchema", () => {
    test("new shift ids must look like shift ids", () => {
        const base = { op: "create", shift: { locationId: "loc", localDate: "2027-02-03", startLocal: "09:00", endLocal: "17:00", role: "Server" } };
        expect(SchedulerChangesInputSchema.safeParse({ changes: [{ ...base, shiftId: "shf_0123456789abcdef" }] }).success).toBe(true);
        expect(SchedulerChangesInputSchema.safeParse({ changes: [{ ...base, shiftId: "anything" }] }).success).toBe(false);
    });

    test("capacity defaults to one and force to false", () => {
        const parsed = SchedulerChangesInputSchema.parse({
            changes: [{ op: "create", shiftId: "shf_0123456789abcdef", shift: { locationId: "loc", localDate: "2027-02-03", startLocal: "09:00", endLocal: "17:00", role: "Server" } }],
        });
        expect(parsed.force).toBe(false);
        expect(parsed.changes[0]).toMatchObject({ shift: { capacity: 1 }, assignees: [] });
    });

    test("patches reject unknown fields", () => {
        expect(SchedulerChangesInputSchema.safeParse({ changes: [{ op: "update", shiftId: "s", patch: { price: 20 } }] }).success).toBe(false);
    });
});
