import { describe, expect, it } from "bun:test";

import type { Shift } from "@/lib/types";
import { groupDraftsByWeek, weekStartOf } from "./draft-groups";

const NY = "America/New_York";

function draft(overrides: Partial<Shift>): Shift {
    return {
        id: "d1",
        title: "Server",
        locationId: "loc-1",
        locationName: "Downtown Bistro",
        startTime: "2026-10-13T21:00:00.000Z",
        endTime: "2026-10-14T03:00:00.000Z",
        timezone: NY,
        status: "draft",
        assignedWorkers: [],
        capacity: { filled: 0, total: 2 },
        ...overrides,
    };
}

describe("weekStartOf", () => {
    it("finds the first day of the week for a Sunday or a Monday week", () => {
        // 2026-10-14 is a Wednesday.
        expect(weekStartOf("2026-10-14", 0)).toBe("2026-10-11");
        expect(weekStartOf("2026-10-14", 1)).toBe("2026-10-12");
        expect(weekStartOf("2026-10-11", 0)).toBe("2026-10-11");
        expect(weekStartOf("2026-10-11", 1)).toBe("2026-10-05");
    });

    it("crosses a month and a year boundary", () => {
        expect(weekStartOf("2026-11-01", 1)).toBe("2026-10-26");
        expect(weekStartOf("2027-01-01", 1)).toBe("2026-12-28");
    });
});

describe("groupDraftsByWeek", () => {
    it("puts drafts of the same location and week together, with open slots added up", () => {
        const groups = groupDraftsByWeek(
            [
                draft({ id: "a", startTime: "2026-10-14T21:00:00.000Z", capacity: { filled: 1, total: 3 } }),
                draft({ id: "b", startTime: "2026-10-13T21:00:00.000Z", capacity: { filled: 0, total: 2 } }),
            ],
            1,
        );

        expect(groups).toHaveLength(1);
        expect(groups[0]!.weekStart).toBe("2026-10-12");
        expect(groups[0]!.open).toBe(4);
        expect(groups[0]!.shifts.map((s) => s.id)).toEqual(["b", "a"]);
    });

    it("keeps locations and weeks apart, soonest week first", () => {
        const groups = groupDraftsByWeek(
            [
                draft({ id: "next-week", startTime: "2026-10-20T21:00:00.000Z" }),
                draft({ id: "other-site", locationId: "loc-2", locationName: "Harbor Room" }),
                draft({ id: "this-week" }),
            ],
            1,
        );

        expect(groups.map((g) => [g.weekStart, g.locationName])).toEqual([
            ["2026-10-12", "Downtown Bistro"],
            ["2026-10-12", "Harbor Room"],
            ["2026-10-19", "Downtown Bistro"],
        ]);
    });

    it("files a Sunday-evening shift in the week it starts in at its own location", () => {
        // 8pm Sunday Oct 18 in New York is 00:00Z Monday Oct 19, and must stay
        // in the week that began Monday Oct 12.
        const [group] = groupDraftsByWeek([draft({ startTime: "2026-10-19T00:00:00.000Z" })], 1);

        expect(group!.weekStart).toBe("2026-10-12");
    });

    it("tracks when the newest draft was added", () => {
        const [group] = groupDraftsByWeek(
            [
                draft({ id: "old", createdAt: "2026-10-01T10:00:00.000Z" }),
                draft({ id: "new", createdAt: "2026-10-03T10:00:00.000Z" }),
            ],
            1,
        );

        expect(group!.latestCreatedAt).toBe("2026-10-03T10:00:00.000Z");
    });
});
