import { beforeEach, describe, expect, mock, test } from "bun:test";

type Row = Record<string, unknown>;

let orgRow: Row | undefined;
let exportRows: Row[] = [];

type Chain = PromiseLike<Row[]> & {
    from: () => Chain;
    innerJoin: () => Chain;
    leftJoin: () => Chain;
    where: () => Chain;
    orderBy: () => Chain;
};
const mockSelect = mock((): Chain => {
    const chain: Chain = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        then: (onfulfilled, onrejected) => Promise.resolve(exportRows).then(onfulfilled, onrejected),
    };
    return chain;
});

mock.module("@repo/database", () => ({
    db: {
        select: mockSelect,
        query: { organization: { findFirst: mock(() => Promise.resolve(orgRow)) } },
    },
}));

const { exportTimesheets } = await import("../src/modules/reporting/export-timesheets");

const row = (over: Row = {}): Row => ({
    workerId: "wkr_1",
    workerName: "Maria Santos",
    workerEmail: null,
    position: "Server",
    locationName: "Harbor Street Café - Midtown",
    locationTimezone: "America/New_York",
    // 5pm to 11pm in New York on 3 Oct 2026 (EDT, UTC-4)
    scheduledStart: new Date("2026-10-03T21:00:00Z"),
    scheduledEnd: new Date("2026-10-04T03:00:00Z"),
    clockIn: new Date("2026-10-03T21:03:00Z"),
    clockOut: new Date("2026-10-04T03:10:00Z"),
    breakMinutes: 30,
    totalDurationMinutes: 337,
    assignmentStatus: "approved",
    ...over,
});

const lines = (csv: string) => csv.split("\r\n");

describe("exportTimesheets", () => {
    beforeEach(() => {
        orgRow = { regionalOvertimePolicy: "weekly_40", timezone: "America/New_York" };
        exportRows = [row()];
    });

    test("reads the times as the venue's wall clock, not UTC", async () => {
        const result = await exportTimesheets("org_1", { start: "2026-10-01", end: "2026-10-07", format: "csv" });

        const [header, first] = lines(result.data as string);
        expect(header).toContain("Start Time,End Time");
        // The shift started at 5:03pm and ended at 11:10pm in New York.
        expect(first).toBe("Maria Santos,,2026-10-03,17:03,23:10,30,5.62,0.00,5.62");
    });

    test("a shift that crosses midnight UTC still belongs to the day it started on locally", async () => {
        exportRows = [row({ scheduledStart: new Date("2026-10-04T01:00:00Z"), clockIn: new Date("2026-10-04T01:00:00Z"), clockOut: new Date("2026-10-04T05:00:00Z") })];

        const result = await exportTimesheets("org_1", { start: "2026-10-01", end: "2026-10-07", format: "csv" });

        // 9pm Saturday in New York is already Sunday in UTC.
        expect(lines(result.data as string)[1]!.split(",").slice(2, 5)).toEqual(["2026-10-03", "21:00", "01:00"]);
    });

    test("falls back to the business's time zone when a venue has none", async () => {
        orgRow = { regionalOvertimePolicy: "weekly_40", timezone: "America/Los_Angeles" };
        exportRows = [row({ locationTimezone: null })];

        const result = await exportTimesheets("org_1", { start: "2026-10-01", end: "2026-10-07", format: "csv" });

        // 21:03 UTC is 2:03pm in Los Angeles.
        expect(lines(result.data as string)[1]!.split(",")[3]).toBe("14:03");
    });

    test("carries hours, never pay", async () => {
        const result = await exportTimesheets("org_1", { start: "2026-10-01", end: "2026-10-07", format: "csv" });

        expect(lines(result.data as string)[0]).toBe(
            "Worker Name,Email,Date,Start Time,End Time,Break (min),Regular Hours,Overtime Hours,Total Hours",
        );
        expect(result.data as string).not.toMatch(/\$|rate|pay/i);
    });

    test("includes agency temps and workers who are not on the app yet", async () => {
        exportRows = [row({ workerName: "Temp 1" }), row({ workerName: "Luis Ortega", workerEmail: null })];

        const result = await exportTimesheets("org_1", { start: "2026-10-01", end: "2026-10-07", format: "csv" });

        expect(lines(result.data as string).map((l) => l.split(",")[0]).slice(1)).toEqual(["Temp 1", "Luis Ortega"]);
    });
});
