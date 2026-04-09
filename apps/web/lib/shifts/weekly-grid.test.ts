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
        startTime: overrides.startTime || "2026-04-06T13:00:00.000Z",
        endTime: overrides.endTime || "2026-04-06T21:00:00.000Z",
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
    test("builds day columns with positioned events and overlap metadata", () => {
        const weekStart = new Date("2026-04-05T00:00:00.000Z");
        const shifts = [
            createShift({
                id: "shift-1",
                title: "Host",
                locationName: "Ballroom",
                startTime: "2026-04-06T13:00:00.000Z",
                endTime: "2026-04-06T17:00:00.000Z",
            }),
            createShift({
                id: "shift-2",
                title: "Server",
                locationName: "Ballroom",
                startTime: "2026-04-06T14:00:00.000Z",
                endTime: "2026-04-06T18:00:00.000Z",
            }),
            createShift({
                id: "shift-3",
                title: "Runner",
                locationName: "Patio",
                startTime: "2026-04-08T15:00:00.000Z",
                endTime: "2026-04-08T19:00:00.000Z",
            }),
        ];

        const model = buildWeeklyGridModel(shifts, weekStart);

        expect(model.hasShifts).toBe(true);
        expect(model.days).toHaveLength(7);
        expect(model.startHour).toBe(6);
        expect(model.endHour).toBe(22);
        expect(model.timeSlots).toHaveLength(16);

        const monday = model.days[1];
        expect(monday?.events).toHaveLength(2);
        expect(monday?.events.map((event) => event.shift.id)).toEqual(["shift-1", "shift-2"]);
        expect(monday?.events[0]?.column).toBe(0);
        expect(monday?.events[0]?.columnCount).toBe(2);
        expect(monday?.events[1]?.column).toBe(1);
        expect(monday?.events[1]?.columnCount).toBe(2);

        const wednesday = model.days[3];
        expect(wednesday?.events).toHaveLength(1);
        expect(wednesday?.events[0]?.locationName).toBe("Patio");
    });

    test("splits overnight shifts across visible days", () => {
        const weekStart = new Date("2026-04-05T00:00:00.000Z");
        const shifts = [
            createShift({
                id: "overnight",
                title: "Night Porter",
                startTime: "2026-04-06T22:00:00.000Z",
                endTime: "2026-04-07T02:00:00.000Z",
            }),
        ];

        const model = buildWeeklyGridModel(shifts, weekStart);

        expect(model.days[1]?.events).toHaveLength(1);
        expect(model.days[1]?.events[0]?.startMinutes).toBe(1320);
        expect(model.days[1]?.events[0]?.endMinutes).toBe(1440);

        expect(model.days[2]?.events).toHaveLength(1);
        expect(model.days[2]?.events[0]?.startMinutes).toBe(0);
        expect(model.days[2]?.events[0]?.endMinutes).toBe(120);
    });
});

describe("getInitialWeekStart", () => {
    test("defaults to the current week", () => {
        const shifts = [
            createShift({
                startTime: "2026-04-12T13:00:00.000Z",
                endTime: "2026-04-12T21:00:00.000Z",
            }),
        ];

        const weekStart = getInitialWeekStart(shifts, new Date("2026-04-01T12:00:00.000Z"));

        expect(weekStart.toISOString()).toBe("2026-03-29T00:00:00.000Z");
    });
});
