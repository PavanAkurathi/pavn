import { describe, expect, test } from "bun:test";

import type { Shift } from "@/lib/types";
import { SHIFT_LAYOUTS } from "@/lib/constants";
import {
    buildWeeklyGridModel,
    getInitialWeekStart,
    resolveShiftLayout,
} from "@/lib/shifts/weekly-grid";

function createShift(overrides: Partial<Shift>): Shift {
    return {
        id: overrides.id || crypto.randomUUID(),
        title: overrides.title || "Server",
        locationName: overrides.locationName || "Main Hall",
        startTime: overrides.startTime || "2026-04-05T13:00:00.000Z",
        endTime: overrides.endTime || "2026-04-05T21:00:00.000Z",
        status: overrides.status || "published",
        assignedWorkers: overrides.assignedWorkers || [],
        capacity: overrides.capacity,
        locationId: overrides.locationId,
        locationAddress: overrides.locationAddress,
        description: overrides.description,
        geofenceRadius: overrides.geofenceRadius,
        attendanceVerificationPolicy: overrides.attendanceVerificationPolicy,
        contactId: overrides.contactId,
        workerId: overrides.workerId,
    };
}

describe("resolveShiftLayout", () => {
    test("defaults upcoming to weekly", () => {
        expect(resolveShiftLayout("upcoming", null)).toBe(SHIFT_LAYOUTS.WEEKLY);
    });

    test("defaults past to list and blocks weekly", () => {
        expect(resolveShiftLayout("past", null)).toBe(SHIFT_LAYOUTS.LIST);
        expect(resolveShiftLayout("past", SHIFT_LAYOUTS.WEEKLY)).toBe(SHIFT_LAYOUTS.LIST);
    });
});

describe("buildWeeklyGridModel", () => {
    test("groups shifts into stable location lanes for the selected week", () => {
        const weekStart = new Date("2026-04-05T00:00:00.000Z");
        const shifts = [
            createShift({
                id: "shift-1",
                title: "Server",
                locationName: "Ballroom",
                locationId: "loc-1",
                startTime: "2026-04-06T13:00:00.000Z",
                endTime: "2026-04-06T21:00:00.000Z",
            }),
            createShift({
                id: "shift-2",
                title: "Server",
                locationName: "Ballroom",
                locationId: "loc-1",
                startTime: "2026-04-08T13:00:00.000Z",
                endTime: "2026-04-08T21:00:00.000Z",
            }),
            createShift({
                id: "shift-3",
                title: "Bartender",
                locationName: "Ballroom",
                locationId: "loc-1",
                startTime: "2026-04-07T15:00:00.000Z",
                endTime: "2026-04-07T23:00:00.000Z",
            }),
            createShift({
                id: "shift-4",
                title: "Server",
                locationName: "Patio",
                locationId: "loc-2",
                startTime: "2026-04-06T13:00:00.000Z",
                endTime: "2026-04-06T21:00:00.000Z",
            }),
            createShift({
                id: "shift-5",
                title: "Server",
                locationName: "Ballroom",
                locationId: "loc-1",
                startTime: "2026-04-06T13:00:00.000Z",
                endTime: "2026-04-06T21:00:00.000Z",
            }),
            createShift({
                id: "shift-6",
                title: "Server",
                locationName: "Ballroom",
                locationId: "loc-1",
                startTime: "2026-04-15T13:00:00.000Z",
                endTime: "2026-04-15T21:00:00.000Z",
            }),
        ];

        const model = buildWeeklyGridModel(shifts, weekStart);

        expect(model.days).toHaveLength(7);
        expect(model.sections).toHaveLength(2);
        expect(model.sections[0]?.locationName).toBe("Ballroom");

        const ballroomLanes = model.sections[0]?.lanes || [];
        expect(ballroomLanes).toHaveLength(2);
        expect(ballroomLanes[0]?.title).toBe("Server");
        expect(ballroomLanes[1]?.title).toBe("Bartender");

        const mondayServerCell = ballroomLanes[0]?.cells[1];
        expect(mondayServerCell?.shifts.map((shift) => shift.id)).toEqual(["shift-1", "shift-5"]);

        const wednesdayServerCell = ballroomLanes[0]?.cells[3];
        expect(wednesdayServerCell?.shifts.map((shift) => shift.id)).toEqual(["shift-2"]);
    });
});

describe("getInitialWeekStart", () => {
    test("uses the first upcoming shift week when available", () => {
        const shifts = [
            createShift({
                startTime: "2026-04-12T13:00:00.000Z",
                endTime: "2026-04-12T21:00:00.000Z",
            }),
        ];

        const weekStart = getInitialWeekStart(shifts, new Date("2026-04-01T12:00:00.000Z"));

        expect(weekStart.toISOString()).toBe("2026-04-12T00:00:00.000Z");
    });
});
