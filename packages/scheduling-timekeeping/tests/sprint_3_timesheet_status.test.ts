
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { getShiftTimesheets } from "../src/modules/time-tracking/get-timesheets";
import { TimesheetWorker } from "../src/types";

// Mock DB
// Explicitly cast to any[] to avoid 'never[]' inference
const mockFindFirst = mock(() => Promise.resolve({ id: "shift_1", title: "Host Stand" }));
const mockFindMany = mock(() => Promise.resolve([] as any[]));

mock.module("../src/modules/time-tracking/reconcile-overdue-shifts", () => ({
    reconcileOverdueShiftState: mock(() => Promise.resolve()),
}));

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

        const res = await getShiftTimesheets("shift_1", "org_1");
        const data = res as TimesheetWorker[];

        expect(data[0]!.status).toBe("rostered");
        expect(data[1]!.status).toBe("rostered");
    });

    test("maps 'completed' to 'submitted'", async () => {
        mockFindMany.mockResolvedValue([
            { id: "3", status: "completed", worker: { name: "C" } }
        ]);
        const res = await getShiftTimesheets("shift_1", "org_1");
        const data = res as TimesheetWorker[];
        expect(data[0]!.status).toBe("submitted");
    });

    test("maps 'approved' to 'approved'", async () => {
        mockFindMany.mockResolvedValue([
            { id: "4", status: "approved", worker: { name: "D" } }
        ]);
        const res = await getShiftTimesheets("shift_1", "org_1");
        const data = res as TimesheetWorker[];
        expect(data[0]!.status).toBe("approved");
    });

    test("maps 'cancelled' and 'no_show' to 'blocked'", async () => {
        mockFindMany.mockResolvedValue([
            { id: "5", status: "cancelled", worker: { name: "E" } },
            { id: "6", status: "no_show", worker: { name: "F" } }
        ]);
        const res = await getShiftTimesheets("shift_1", "org_1");
        const data = res as TimesheetWorker[];
        expect(data[0]!.status).toBe("cancelled");
        expect(data[1]!.status).toBe("no-show");
    });

    test("filters removed assignments and uses the shift title as role", async () => {
        mockFindMany.mockResolvedValue([
            { id: "7", workerId: "worker_7", status: "removed", worker: { name: "Removed Worker" } },
            { id: "8", workerId: "worker_8", status: "active", worker: { name: "Live Worker", image: "img" } }
        ]);

        const res = await getShiftTimesheets("shift_1", "org_1");
        const data = res as TimesheetWorker[];

        expect(data).toHaveLength(1);
        expect(data[0]!.workerId).toBe("worker_8");
        expect(data[0]!.role).toBe("Host Stand");
        expect(data[0]!.status).toBe("rostered");
    });
});
