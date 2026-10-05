import { describe, expect, it } from "bun:test";

import type { Shift } from "@/lib/types";
import {
    filterActiveShifts,
    filterHistoryShifts,
    filterInProgressShifts,
    filterNeedsApprovalShifts,
    formatShiftDateLabel,
    groupShiftsByDate,
} from "@/lib/shifts/view-list";

function isoMinutesFromNow(offsetMinutes: number) {
    return new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
}

function createShift(overrides: Partial<Shift>): Shift {
    return {
        id: "shift-1",
        title: "Dining Room Opener",
        locationName: "Downtown Bistro",
        startTime: isoMinutesFromNow(-180),
        endTime: isoMinutesFromNow(120),
        status: "published",
        assignedWorkers: [],
        capacity: {
            filled: 0,
            total: 1,
        },
        ...overrides,
    };
}

describe("shift view filters", () => {
    it("keeps only not-yet-ended active shifts in the active bucket", () => {
        const active = filterActiveShifts([
            createShift({
                id: "future-published",
                endTime: isoMinutesFromNow(120),
                status: "published",
            }),
            createShift({
                id: "future-assigned",
                endTime: isoMinutesFromNow(60),
                status: "assigned",
                assignedWorkers: [{ id: "worker-1", initials: "W1", name: "Worker One" }],
                capacity: { filled: 1, total: 1 },
            }),
            createShift({
                id: "ended-assigned",
                endTime: isoMinutesFromNow(-1),
                status: "assigned",
                assignedWorkers: [{ id: "worker-2", initials: "W2", name: "Worker Two" }],
                capacity: { filled: 1, total: 1 },
            }),
            createShift({
                id: "approved",
                endTime: isoMinutesFromNow(-90),
                status: "approved",
            }),
        ]);

        expect(active.map((shift) => shift.id)).toEqual(["future-published", "future-assigned"]);
    });

    it("picks out the shifts happening right now", () => {
        const now = filterInProgressShifts([
            createShift({ id: "started-not-ended", startTime: isoMinutesFromNow(-60), endTime: isoMinutesFromNow(60) }),
            createShift({ id: "not-started", startTime: isoMinutesFromNow(30), endTime: isoMinutesFromNow(240) }),
            createShift({ id: "ended", startTime: isoMinutesFromNow(-300), endTime: isoMinutesFromNow(-10) }),
            createShift({ id: "draft-in-window", startTime: isoMinutesFromNow(-60), endTime: isoMinutesFromNow(60), status: "draft" }),
        ]);

        expect(now.map((shift) => shift.id)).toEqual(["started-not-ended"]);
    });

    it("treats only staffed past shifts as action required", () => {
        const pending = filterNeedsApprovalShifts([
            createShift({
                id: "completed-staffed",
                endTime: isoMinutesFromNow(-30),
                status: "completed",
                assignedWorkers: [{ id: "worker-1", initials: "W1", name: "Worker One" }],
                capacity: { filled: 1, total: 1 },
            }),
            createShift({
                id: "ended-assigned",
                endTime: isoMinutesFromNow(-15),
                status: "assigned",
                assignedWorkers: [{ id: "worker-2", initials: "W2", name: "Worker Two" }],
                capacity: { filled: 1, total: 1 },
            }),
            createShift({
                id: "ended-open",
                endTime: isoMinutesFromNow(-60),
                status: "published",
                assignedWorkers: [],
                capacity: { filled: 0, total: 2 },
            }),
            createShift({
                id: "approved",
                endTime: isoMinutesFromNow(-90),
                status: "approved",
                assignedWorkers: [{ id: "worker-3", initials: "W3", name: "Worker Three" }],
                capacity: { filled: 1, total: 1 },
            }),
        ]);

        expect(pending.map((shift) => shift.id)).toEqual(["completed-staffed", "ended-assigned"]);
    });

    it("keeps non-pending past shifts in history", () => {
        const history = filterHistoryShifts([
            createShift({
                id: "approved",
                endTime: isoMinutesFromNow(-90),
                status: "approved",
                assignedWorkers: [{ id: "worker-1", initials: "W1", name: "Worker One" }],
                capacity: { filled: 1, total: 1 },
            }),
            createShift({
                id: "cancelled",
                endTime: isoMinutesFromNow(-75),
                status: "cancelled",
            }),
            createShift({
                id: "ended-open",
                endTime: isoMinutesFromNow(-60),
                status: "published",
                assignedWorkers: [],
                capacity: { filled: 0, total: 2 },
            }),
            createShift({
                id: "completed-staffed",
                endTime: isoMinutesFromNow(-30),
                status: "completed",
                assignedWorkers: [{ id: "worker-2", initials: "W2", name: "Worker Two" }],
                capacity: { filled: 1, total: 1 },
            }),
        ]);

        expect(history.map((shift) => shift.id)).toEqual(["approved", "cancelled", "ended-open"]);
    });
});

describe("shift list grouping", () => {
    it("files a shift under the day it starts at its own location", () => {
        // 8pm in New York on Oct 25 is 00:00Z on Oct 26.
        const evening = createShift({
            id: "evening",
            startTime: "2026-10-26T00:00:00.000Z",
            endTime: "2026-10-26T04:00:00.000Z",
            timezone: "America/New_York",
        });
        const lunch = createShift({
            id: "lunch",
            startTime: "2026-10-25T16:00:00.000Z",
            endTime: "2026-10-25T20:00:00.000Z",
            timezone: "America/New_York",
        });

        const grouped = groupShiftsByDate([evening, lunch]);

        expect(Object.keys(grouped)).toEqual(["2026-10-25"]);
        expect(grouped["2026-10-25"]?.map((shift) => shift.id)).toEqual(["evening", "lunch"]);
    });

    it("labels a day the way the list headers read", () => {
        expect(formatShiftDateLabel("2026-10-25")).toBe("Sun Oct 25, 2026");
    });
});
