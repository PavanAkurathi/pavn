
import { describe, expect, test, mock, beforeEach, setSystemTime } from "bun:test";
import { getPendingShifts } from "../src/services/pending";

// Mock Data
const shifts = [] as any[];

const mockFindMany = mock(() => Promise.resolve(shifts));

mock.module("@repo/database", () => ({
    db: {
        query: {
            shift: {
                findMany: mockFindMany
            }
        }
    }
}));

describe.skip("WH-114: Ghost Shift Tuning", () => {
    beforeEach(() => {
        mockFindMany.mockClear();
        shifts.length = 0;
        setSystemTime(new Date("2026-01-20T12:00:00Z")); // Current Time: 12:00 PM
    });

    test("4h shift uses 2h minimum buffer", async () => {
        // Shift: 6am - 10am (4h duration)
        // Buffer: Max(2h, Min(6h, 1h)) = 2h
        // Threshold: 10am + 2h = 12pm
        // Current Time: 12:00pm -> Should act as ghost? Wait, lt(endTime, twoHoursAgo)
        // DB filter (2h ago) = 10am. 
        // If ended at 9:59am, it IS passed DB filter.
        // Dynamic calc: End 9:59. Threshold 12:00 - 2h = 10:00. 9:59 < 10:00 -> TRUE.

        const shift4h = {
            id: "s1",
            status: "in-progress",
            startTime: new Date("2026-01-20T06:00:00Z"), // 6am
            endTime: new Date("2026-01-20T09:59:00Z"),   // 9:59am (Ended > 2h ago)
            assignments: [],
            location: {}
        };
        shifts.push(shift4h);

        const res = await getPendingShifts("org_1");
        const data = res as any[];

        expect(data.length).toBe(1);
        expect(data[0].id).toBe("s1");
    });

    test("12h shift uses 3h buffer (25%)", async () => {
        // Shift: 12am - 12pm -> Duration 12h
        // Buffer: 12h * 0.25 = 3h.

        // Scenario A: Ended 2.5 hours ago (Should NOT show)
        // Time now: 12:00 PM.
        // End time: 9:30 AM (2.5h ago).
        // DB filter (2h ago): 9:30 < 10:00 -> Included in SQL.
        // Memory filter: Threshold = 12:00 - 3h = 9:00 AM.
        // Check: End (9:30) < Threshold (9:00)? FALSE.

        const shift12h = {
            id: "s2",
            status: "in-progress",
            startTime: new Date("2026-01-19T21:30:00Z"), // 9:30 PM prev day
            endTime: new Date("2026-01-20T09:30:00Z"),   // 9:30 AM today (12h)
            assignments: [],
            location: {}
        };
        shifts.push(shift12h);

        const res = await getPendingShifts("org_1");
        const data = res as any[];
        expect(data.length).toBe(0); // Filtered out by dynamic buffer

        // Scenario B: Ended 3.1 hours ago (Should SHOW)
        // End time: 8:50 AM.
        // Check: End (8:50) < Threshold (9:00)? TRUE.
        shift12h.startTime = new Date("2026-01-19T20:50:00Z");
        shift12h.endTime = new Date("2026-01-20T08:50:00Z");

        const res2 = await getPendingShifts("org_1");
        const data2 = await res2 as any[];
        expect(data2.length).toBe(1);
    });
});
