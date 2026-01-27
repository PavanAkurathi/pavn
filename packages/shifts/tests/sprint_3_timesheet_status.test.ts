
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { getShiftTimesheetsController } from "../src/controllers/get-timesheets";
import { TimesheetWorker } from "../src/types";

// Mock DB
// Explicitly cast to any[] to avoid 'never[]' inference
const mockFindFirst = mock(() => Promise.resolve({ id: "shift_1" }));
const mockFindMany = mock(() => Promise.resolve([] as any[]));

mock.module("@repo/database", () => ({
    db: {
        query: {
            shift: {
                findFirst: mockFindFirst
            },
            shiftAssignment: {
                findMany: mockFindMany
            }
        }
    }
}));

describe("WH-117: Timesheet Status Mapping", () => {
    beforeEach(() => {
        mockFindMany.mockClear();
        // Reset to empty array by default
        mockFindMany.mockResolvedValue([]);
    });

    test("maps 'active' and 'assigned' to 'rostered'", async () => {
        mockFindMany.mockResolvedValue([
            { id: "1", status: "active", worker: { name: "A", image: "img" } },
            { id: "2", status: "assigned", worker: { name: "B" } }
        ]);

        const res = await getShiftTimesheetsController("shift_1", "org_1");
        const data = await res.json() as TimesheetWorker[];

        expect(data[0]!.status).toBe("rostered");
        expect(data[1]!.status).toBe("rostered");
    });

    test("maps 'completed' to 'submitted'", async () => {
        mockFindMany.mockResolvedValue([
            { id: "3", status: "completed", worker: { name: "C" } }
        ]);
        const res = await getShiftTimesheetsController("shift_1", "org_1");
        const data = await res.json() as TimesheetWorker[];
        expect(data[0]!.status).toBe("submitted");
    });

    test("maps 'approved' to 'approved'", async () => {
        mockFindMany.mockResolvedValue([
            { id: "4", status: "approved", worker: { name: "D" } }
        ]);
        const res = await getShiftTimesheetsController("shift_1", "org_1");
        const data = await res.json() as TimesheetWorker[];
        expect(data[0]!.status).toBe("approved");
    });

    test("maps 'cancelled' and 'no_show' to 'blocked'", async () => {
        mockFindMany.mockResolvedValue([
            { id: "5", status: "cancelled", worker: { name: "E" } },
            { id: "6", status: "no_show", worker: { name: "F" } }
        ]);
        const res = await getShiftTimesheetsController("shift_1", "org_1");
        const data = await res.json() as TimesheetWorker[];
        expect(data[0]!.status).toBe("blocked");
        expect(data[1]!.status).toBe("blocked");
    });
});
