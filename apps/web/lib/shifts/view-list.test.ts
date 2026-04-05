import { describe, expect, it } from "bun:test";

import type { Shift } from "@/lib/types";
import {
    filterActiveShifts,
    filterHistoryShifts,
    filterNeedsApprovalShifts,
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
