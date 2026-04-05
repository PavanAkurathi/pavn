
import { describe, expect, test, mock, beforeEach, setSystemTime } from "bun:test";
import { getPendingShifts } from "../src/modules/shifts/pending";

// Mock Data
const shifts = [] as any[];

const mockFindMany = mock(() => Promise.resolve(shifts));

mock.module("../src/modules/time-tracking/reconcile-overdue-shifts", () => ({
    reconcileOverdueShiftState: mock(() => Promise.resolve()),
}));

mock.module("@repo/database", () => ({
    db: {
        query: {
            shift: {
                findMany: mockFindMany
            }
        }
    }
}));

describe("WH-114: Past shift visibility", () => {
    beforeEach(() => {
        mockFindMany.mockClear();
        shifts.length = 0;
        setSystemTime(new Date("2026-01-20T12:00:00Z")); // Current Time: 12:00 PM
    });

    test("staffed shifts move into pending immediately once end time is reached", async () => {
        const endedShift = {
            id: "s1",
            status: "in-progress",
            startTime: new Date("2026-01-20T06:00:00Z"), // 6am
            endTime: new Date("2026-01-20T11:59:00Z"),   // ended one minute ago
            assignments: [{ status: "completed" }],
            location: {},
        };
        shifts.push(endedShift);

        const res = await getPendingShifts("org_1");
        const data = res as any[];

        expect(data.length).toBe(1);
        expect(data[0].id).toBe("s1");
    });

    test("unstaffed ended shifts do not appear in pending approval", async () => {
        const unstaffedShift = {
            id: "s2",
            status: "published",
            startTime: new Date("2026-01-20T06:00:00Z"),
            endTime: new Date("2026-01-20T11:45:00Z"),
            assignments: [],
            location: {},
        };
        shifts.push(unstaffedShift);

        const res = await getPendingShifts("org_1");
        const data = res as any[];
        expect(data.length).toBe(0);
    });
});
