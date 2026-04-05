import { describe, expect, it } from "bun:test";
import { startOfWeek } from "date-fns";

import { buildWeeklyGridModel } from "@/lib/shifts/weekly-grid";
import {
    getDashboardMockBundle,
    getDashboardMockShifts,
    getDashboardMockTimesheets,
    isDashboardMockShiftId,
} from "@/lib/shifts/data";

const anchorDate = new Date(2026, 3, 4, 13, 0, 0);

describe("dashboard mock data", () => {
    it("provides a populated current-week grid for upcoming shifts", () => {
        const upcomingShifts = getDashboardMockShifts("upcoming", anchorDate);
        const grid = buildWeeklyGridModel(
            upcomingShifts,
            startOfWeek(anchorDate, { weekStartsOn: 0 }),
        );

        expect(upcomingShifts.length).toBeGreaterThan(0);
        expect(grid.sections.length).toBeGreaterThan(0);
        expect(grid.sections.some((section) => section.lanes.length > 0)).toBe(true);
        expect(upcomingShifts.every((shift) => isDashboardMockShiftId(shift.id))).toBe(true);
    });

    it("keeps timesheet drill-in data aligned with mocked shift ids", () => {
        const bundle = getDashboardMockBundle(anchorDate);
        const shiftWithTimesheet = bundle.upcomingShifts.find((shift) =>
            bundle.timesheetsByShiftId[shift.id]?.length,
        );

        expect(shiftWithTimesheet).toBeDefined();

        const timesheets = getDashboardMockTimesheets(shiftWithTimesheet!.id, anchorDate);
        expect(timesheets.length).toBeGreaterThan(0);
        expect(timesheets[0]?.workerId).toContain("mock-worker-");
        expect(timesheets[0]?.id).toContain(shiftWithTimesheet!.id);
    });
});
