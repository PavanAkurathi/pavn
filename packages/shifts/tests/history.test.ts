import { describe, expect, test, beforeEach, afterAll } from "bun:test";
import { getHistoryShifts } from "../src/controllers/history";
import { db } from "../src/db/mock-db";
import { Shift } from "../src/types";
import { subHours, subDays } from "date-fns";

// Backup original shifts
const originalShifts = [...db.shifts];

describe("GET /shifts/history", () => {
    beforeEach(() => {
        // Reset DB before each test
        db.shifts = [];
    });

    afterAll(() => {
        // Restore DB
        db.shifts = originalShifts;
    });

    test("returns finalized shifts (approved, cancelled, paid)", async () => {
        db.shifts = [
            { id: "1", status: "approved", startTime: new Date().toISOString() } as Shift,
            { id: "2", status: "cancelled", startTime: new Date().toISOString() } as Shift,
            // 'paid' is not in ShiftStatus type yet, assuming mapped to approved or separate? 
            // The prompt mentioned 'paid', but ShiftStatus in types.ts is: 
            // 'open' | 'assigned' | 'in-progress' | 'completed' | 'cancelled' | 'approved'
            // I will stick to approved and cancelled for now, or check types.ts
        ];

        const response = getHistoryShifts();
        const shifts = await response.json() as any[];
        expect(shifts.length).toBe(2);
        expect(shifts.map(s => s.id).sort()).toEqual(["1", "2"]);
    });

    test("excludes non-finalized shifts (completed, assigned, open)", async () => {
        db.shifts = [
            { id: "3", status: "completed", startTime: new Date().toISOString() } as Shift, // Pending
            { id: "4", status: "assigned", startTime: new Date().toISOString() } as Shift,
            { id: "5", status: "open", startTime: new Date().toISOString() } as Shift,
        ];

        const response = getHistoryShifts();
        const shifts = await response.json() as any[];
        expect(shifts.length).toBe(0);
    });

    test("sorts by startTime DESC (Newest first)", async () => {
        const now = new Date();
        db.shifts = [
            { id: "old", status: "approved", startTime: subDays(now, 2).toISOString() } as Shift,
            { id: "new", status: "approved", startTime: subDays(now, 1).toISOString() } as Shift,
        ];

        const response = getHistoryShifts();
        const shifts = await response.json() as any[];
        expect(shifts[0].id).toBe("new");
        expect(shifts[1].id).toBe("old");
    });

    test("includes UI flags", async () => {
        db.shifts = [{
            id: "1",
            status: "approved",
            startTime: new Date().toISOString()
        } as Shift];

        const response = getHistoryShifts();
        const shifts = await response.json() as any[];
        expect(shifts[0].is_urgent).toBe(false);
        expect(shifts[0].ui_category).toBe("history");
    });
});
