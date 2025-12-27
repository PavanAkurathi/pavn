import { describe, expect, test, beforeEach, afterAll } from "bun:test";
import { getPendingShifts } from "../src/controllers/pending";
import { db } from "../src/db/mock-db";
import { Shift } from "../src/types";
import { addHours, subHours } from "date-fns";

// Backup original shifts
const originalShifts = [...db.shifts];

describe("GET /shifts/pending-approval", () => {
    beforeEach(() => {
        // Reset DB before each test
        db.shifts = [];
    });

    afterAll(() => {
        // Restore DB
        db.shifts = originalShifts;
    });

    test("returns completed shifts", async () => {
        db.shifts = [{
            id: "1",
            title: "Completed Shift",
            status: "completed",
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            locationName: "Test Loc"
        } as Shift];

        const response = getPendingShifts();
        const shifts = await response.json();
        expect(shifts.length).toBe(1);
        expect(shifts[0].id).toBe("1");
    });

    test("ignores assigned shifts ended < 2 hours ago", async () => {
        const now = new Date();
        db.shifts = [{
            id: "2",
            title: "Recent Shift",
            status: "assigned",
            startTime: subHours(now, 4).toISOString(),
            endTime: subHours(now, 1).toISOString(), // Ended 1 hour ago
            locationName: "Test Loc"
        } as Shift];

        const response = getPendingShifts();
        const shifts = await response.json();
        expect(shifts.length).toBe(0);
    });

    test("includes assigned shifts ended > 2 hours ago (Ghost Shifts)", async () => {
        const now = new Date();
        db.shifts = [{
            id: "3",
            title: "Ghost Shift",
            status: "assigned",
            startTime: subHours(now, 6).toISOString(),
            endTime: subHours(now, 3).toISOString(), // Ended 3 hours ago
            locationName: "Test Loc"
        } as Shift];

        const response = getPendingShifts();
        const shifts = await response.json();
        expect(shifts.length).toBe(1);
        expect(shifts[0].id).toBe("3");
    });

    test("includes UI flags", async () => {
        db.shifts = [{
            id: "1",
            status: "completed",
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            locationName: "Test"
        } as Shift];

        const response = getPendingShifts();
        const shifts = await response.json();
        expect(shifts[0].is_urgent).toBe(true);
        expect(shifts[0].ui_category).toBe("action_required");
    });
});
