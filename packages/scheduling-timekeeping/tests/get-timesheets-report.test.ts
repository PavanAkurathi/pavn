import { beforeEach, describe, expect, mock, test } from "bun:test";

type Row = Record<string, unknown>;

let orgRow: Row | undefined;
let reportRows: Row[] = [];

type Chain = PromiseLike<Row[]> & {
    from: () => Chain;
    innerJoin: () => Chain;
    leftJoin: () => Chain;
    where: () => Chain;
    orderBy: () => Chain;
    limit: () => Chain;
    offset: () => Chain;
};
const mockSelect = mock((): Chain => {
    const chain: Chain = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        offset: () => chain,
        then: (onfulfilled, onrejected) => Promise.resolve(reportRows).then(onfulfilled, onrejected),
    };
    return chain;
});

mock.module("@repo/database", () => ({
    db: {
        select: mockSelect,
        query: { organization: { findFirst: mock(() => Promise.resolve(orgRow)) } },
    },
}));

const { getTimesheetsReport } = await import("../src/modules/reporting/get-timesheets-report");

const row = (over: Row = {}): Row => ({
    assignmentId: "asg_1",
    workerId: "wkr_1",
    workerName: "Jasmine Carter",
    workerEmail: null,
    shiftId: "shf_1",
    position: "Server",
    locationId: "loc_1",
    locationName: "Harbor Street Café - Midtown",
    locationTimezone: "America/New_York",
    // 2:45pm to 3:15pm in New York on 6 Oct 2026 (EDT, UTC-4)
    shiftDate: new Date("2026-10-06T18:45:00Z"),
    scheduledStart: new Date("2026-10-06T18:45:00Z"),
    scheduledEnd: new Date("2026-10-06T19:15:00Z"),
    clockIn: new Date("2026-10-06T18:45:00Z"),
    clockOut: new Date("2026-10-06T19:15:00Z"),
    breakMinutes: 0,
    totalDurationMinutes: 30,
    // Approving a shift marks each assignment "completed".
    assignmentStatus: "completed",
    ...over,
});

describe("getTimesheetsReport", () => {
    beforeEach(() => {
        orgRow = { timezone: "America/New_York" };
        reportRows = [row()];
    });

    test("shows the shift on the day and clock times of the business, with its hours", async () => {
        const { data, summary } = await getTimesheetsReport("org_1", { start: "2026-10-01", end: "2026-10-31" });

        expect(data[0]!.shift).toMatchObject({ date: "2026-10-06", scheduledStart: "14:45", scheduledEnd: "15:15" });
        expect(data[0]!.timesheet).toMatchObject({ actualStart: "14:45", actualEnd: "15:15", totalHours: 0.5 });
        expect(summary.totalHours).toBe(0.5);
    });

    test("uses the site's time zone, whatever zone the server is in", async () => {
        // 8pm UTC on 6 Oct is already 5am on 7 Oct in Tokyo.
        reportRows = [
            row({
                locationTimezone: "Asia/Tokyo",
                shiftDate: new Date("2026-10-06T20:00:00Z"),
                scheduledStart: new Date("2026-10-06T20:00:00Z"),
            }),
        ];

        const { data } = await getTimesheetsReport("org_1", { start: "2026-10-01", end: "2026-10-31" });

        expect(data[0]!.shift).toMatchObject({ date: "2026-10-07", scheduledStart: "05:00" });
    });

    test("falls back to the business's time zone when a shift has no site", async () => {
        reportRows = [row({ locationId: null, locationName: null, locationTimezone: null })];

        const { data } = await getTimesheetsReport("org_1", { start: "2026-10-01", end: "2026-10-31" });

        expect(data[0]!.shift.date).toBe("2026-10-06");
        expect(data[0]!.location).toBeNull();
    });

    test("every row is approved: only approved shifts are in this report", async () => {
        const { data } = await getTimesheetsReport("org_1", { start: "2026-10-01", end: "2026-10-31" });

        expect(data[0]!.status).toBe("approved");
    });
});
