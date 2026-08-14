import { describe, test, expect, mock, beforeEach } from "bun:test";

const insertedRows: { shift: unknown[]; shiftAssignment: unknown[] } = { shift: [], shiftAssignment: [] };
let sourceShifts: unknown[] = [];
let targetShifts: unknown[] = [];

const mockDb = {
    query: {
        location: {
            findFirst: mock(() => Promise.resolve({ id: "loc_1", timezone: "America/New_York" })),
        },
        shift: {
            findMany: mock((args: { columns?: unknown }) =>
                // The target-week probe selects columns; the source read does not.
                Promise.resolve(args?.columns ? targetShifts : sourceShifts),
            ),
        },
    },
    transaction: mock(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
            insert: () => ({
                values: (rows: unknown[]) => {
                    // Discriminate on the row shape rather than drizzle internals:
                    // assignments carry shiftId, shifts carry capacityTotal.
                    const key: "shift" | "shiftAssignment" = (rows[0] as { shiftId?: string })?.shiftId ? "shiftAssignment" : "shift";
                    insertedRows[key].push(...rows);
                    return Promise.resolve();
                },
            }),
        };
        await fn(tx);
    }),
};

mock.module("@repo/database", () => ({ db: mockDb }));

const { copyWeek } = await import("../src/modules/shifts/copy-week");

const ORG = "org_1";
const shiftRow = (over: Record<string, unknown> = {}) => ({
    id: "shf_src",
    contactId: null,
    title: "Loader",
    description: null,
    status: "published",
    capacityTotal: 3,
    startTime: new Date("2026-08-13T13:00:00Z"), // Thu 09:00 EDT
    endTime: new Date("2026-08-13T21:00:00Z"),
    assignments: [],
    ...over,
});

describe("copyWeek", () => {
    beforeEach(() => {
        insertedRows.shift = [];
        insertedRows.shiftAssignment = [];
        sourceShifts = [];
        targetShifts = [];
    });

    test("lands the same weekday and wall-clock time, seven days on", async () => {
        sourceShifts = [shiftRow()];

        const result = await copyWeek({ locationId: "loc_1", targetWeekStart: "2026-08-16" }, ORG);

        expect(result.copied).toBe(1);
        const created = insertedRows.shift[0] as { startTime: Date; status: string; timezone: string };
        // Thu 20 Aug, still 09:00 in New York.
        expect(created.startTime.toISOString()).toBe("2026-08-20T13:00:00.000Z");
        expect(created.status).toBe("draft");
        expect(created.timezone).toBe("America/New_York");
    });

    test("keeps the wall clock across a DST change", async () => {
        // Thu 29 Oct 2026 09:00 EDT (UTC-4). The copy lands Thu 5 Nov, after the
        // US clocks go back, so 09:00 local is UTC-5. Adding 7*24h would give
        // 08:00 local instead.
        sourceShifts = [shiftRow({ startTime: new Date("2026-10-29T13:00:00Z"), endTime: new Date("2026-10-29T21:00:00Z") })];

        await copyWeek({ locationId: "loc_1", targetWeekStart: "2026-11-01" }, ORG);

        const created = insertedRows.shift[0] as { startTime: Date };
        expect(created.startTime.toISOString()).toBe("2026-11-05T14:00:00.000Z"); // 09:00 EST
    });

    test("carries roster workers but leaves agency slots open", async () => {
        sourceShifts = [
            shiftRow({
                assignments: [
                    { workerId: "user_1", rosterEntryId: null, tempWorkerId: null, status: "active" },
                    { workerId: null, rosterEntryId: "roster_1", tempWorkerId: null, status: "active" },
                    { workerId: null, rosterEntryId: null, tempWorkerId: "temp_1", status: "active" },
                    { workerId: "user_2", rosterEntryId: null, tempWorkerId: null, status: "removed" },
                ],
            }),
        ];

        const result = await copyWeek({ locationId: "loc_1", targetWeekStart: "2026-08-16" }, ORG);

        // the app user and the invited roster entry, not the agency temp and not
        // the removed assignment
        expect(result.assignmentsCopied).toBe(2);
        const ids = insertedRows.shiftAssignment.map((a) => (a as { workerId: string | null }).workerId);
        expect(ids).toContain("user_1");
        expect(ids).not.toContain("user_2");
    });

    test("skips days that already have shifts, so a second run does not double the week", async () => {
        sourceShifts = [shiftRow()];
        targetShifts = [{ id: "shf_existing", startTime: new Date("2026-08-20T15:00:00Z") }]; // same local day

        const result = await copyWeek({ locationId: "loc_1", targetWeekStart: "2026-08-16" }, ORG);

        expect(result.copied).toBe(0);
        expect(result.skippedDays).toEqual(["2026-08-20"]);
        expect(insertedRows.shift.length).toBe(0);
    });

    test("does not resurrect a shift that was cancelled", async () => {
        sourceShifts = [
            shiftRow({ id: "shf_live", title: "Supervisor" }),
            shiftRow({ id: "shf_dead", title: "Forklift Operator", status: "cancelled" }),
        ];

        const result = await copyWeek({ locationId: "loc_1", targetWeekStart: "2026-08-16" }, ORG);

        expect(result.copied).toBe(1);
        expect(insertedRows.shift.map((s) => (s as { title: string }).title)).toEqual(["Supervisor"]);
    });

    test("a week of nothing but cancellations reads as nothing to copy", async () => {
        sourceShifts = [shiftRow({ status: "cancelled" })];

        const result = await copyWeek({ locationId: "loc_1", targetWeekStart: "2026-08-16" }, ORG);

        expect(result.copied).toBe(0);
        expect(result.message).toContain("Nothing scheduled");
    });

    test("says so when there is nothing to copy", async () => {
        const result = await copyWeek({ locationId: "loc_1", targetWeekStart: "2026-08-16" }, ORG);
        expect(result.copied).toBe(0);
        expect(result.message).toContain("Nothing scheduled");
    });
});
