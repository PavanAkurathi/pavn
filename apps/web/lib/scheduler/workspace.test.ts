import { describe, expect, test } from "bun:test";
import type { SchedulerEvent, SchedulerShift, SchedulerWeek } from "@repo/contracts/scheduler";
import { addDays } from "./format";
import { ALL_SITES, buildDayPlan, mergeWeeks, openShiftsByDay, publishScope, rangeLabel, unfilledByDay } from "./workspace";

// The planning week from the brief: Sunday October 11 to Saturday October 17, 2026.
const WEEK_START = "2026-10-11";
const FRIDAY = "2026-10-16";

const shift = (over: Partial<SchedulerShift>): SchedulerShift => ({
    id: "s",
    locationId: "gsu",
    dayIndex: 5,
    localDate: FRIDAY,
    startLocal: "16:30",
    endLocal: "22:00",
    overnight: false,
    startsAt: "2026-10-16T20:30:00.000Z",
    endsAt: "2026-10-17T02:00:00.000Z",
    role: "Server",
    breakMinutes: 0,
    paidMinutes: 330,
    capacity: 1,
    filled: 1,
    open: 0,
    status: "published",
    hasUnpublishedEdits: false,
    pendingRemoval: false,
    eventId: null,
    note: null,
    managerNote: null,
    assignees: [],
    ...over,
});

const event = (over: Partial<SchedulerEvent>): SchedulerEvent => ({
    id: "evt",
    name: "Alumni reception",
    dayIndex: 5,
    localDate: FRIDAY,
    startLocal: "17:00",
    endLocal: "22:00",
    startsAt: "2026-10-16T21:00:00.000Z",
    endsAt: "2026-10-17T02:00:00.000Z",
    notes: null,
    needed: 6,
    filled: 4,
    ...over,
});

const person = (id: string, name: string, minutes = 0) => ({
    id,
    kind: "roster" as const,
    name,
    initials: name.slice(0, 2).toUpperCase(),
    roles: ["Server"],
    primaryRole: "Server",
    departmentId: null,
    agencyName: null,
    scheduledMinutes: minutes,
    overtimeMinutes: 0,
});

const assignee = (personId: string, pendingState: "add" | "remove" | null = null) => ({
    personId,
    kind: "roster" as const,
    pendingState,
    warnings: [],
});

const week = (site: { id: string; name: string }, shifts: SchedulerShift[], events: SchedulerEvent[] = [], pending = 0): SchedulerWeek => ({
    location: { id: site.id, name: site.name, timezone: "America/New_York" },
    weekStart: WEEK_START,
    weekStartsOn: 0,
    days: Array.from({ length: 7 }, (_, i) => ({ index: i, localDate: addDays(WEEK_START, i), isToday: false })),
    settings: { overtimePolicy: "weekly_40", scheduleStyle: "events", openShiftClaimPolicy: "approval" },
    departments: [],
    people: [person("ana", "Ana Ruiz", 600), person("ben", "Ben Kim", 300)],
    shifts,
    events,
    timeOff: [],
    unavailable: [],
    summary: { openSlots: shifts.reduce((n, s) => n + s.open, 0), pendingChangeCount: pending, pendingRequestCount: 3 },
});

const GSU = { id: "gsu", name: "George Sherman Union" };
const CHARLES = { id: "charles", name: "Charles Hotel" };

describe("mergeWeeks", () => {
    test("one site stays as it is, and its events remember where they are", () => {
        const w = week(GSU, [shift({ id: "a" })], [event({})]);
        const ws = mergeWeeks([w], [GSU]);
        expect(ws.week).toBe(w);
        expect(ws.events[0]!.locationId).toBe("gsu");
    });

    test("all sites: shifts and events from each, people once, hours not added twice", () => {
        const a = week(GSU, [shift({ id: "a", open: 2, capacity: 3, filled: 1 })], [event({ id: "e1" })], 2);
        const b = week(CHARLES, [shift({ id: "b", locationId: "charles", open: 1, capacity: 2, filled: 1 })], [event({ id: "e2", name: "Wedding" })], 1);
        const ws = mergeWeeks([a, b], [GSU, CHARLES]);

        expect(ws.week.location).toEqual({ id: ALL_SITES, name: "All sites", timezone: "America/New_York" });
        expect(ws.week.shifts.map((s) => s.id)).toEqual(["a", "b"]);
        expect(ws.events.map((e) => [e.id, e.locationId])).toEqual([
            ["e1", "gsu"],
            ["e2", "charles"],
        ]);
        expect(ws.week.people).toHaveLength(2);
        expect(ws.week.people.find((p) => p.id === "ana")!.scheduledMinutes).toBe(600);
        expect(ws.week.summary).toEqual({ openSlots: 3, pendingChangeCount: 3, pendingRequestCount: 3 });
    });
});

describe("buildDayPlan", () => {
    const alumni = event({});
    const ws = mergeWeeks(
        [
            week(
                GSU,
                [
                    // Prep starts before the event does.
                    shift({ id: "prep", eventId: "evt", role: "Prep", startLocal: "14:00", endLocal: "17:00", capacity: 2, filled: 2, open: 0, assignees: [assignee("ana"), assignee("ben")] }),
                    shift({ id: "srv", eventId: "evt", role: "Server", capacity: 6, filled: 4, open: 2, assignees: [assignee("ana"), assignee("ben")] }),
                    shift({ id: "lunch", startLocal: "11:00", endLocal: "15:00", capacity: 2, filled: 2, open: 0, assignees: [assignee("ana")] }),
                ],
                [alumni],
            ),
            week(CHARLES, [
                shift({ id: "wed", locationId: "charles", startLocal: "16:00", endLocal: "23:00", role: "Bartender", capacity: 3, filled: 0, open: 3, status: "draft" }),
                shift({ id: "night", locationId: "charles", startLocal: "21:00", endLocal: "02:00", overnight: true, role: "Bartender", capacity: 1, filled: 1, open: 0 }),
                shift({ id: "other-day", locationId: "charles", localDate: "2026-10-15", dayIndex: 4 }),
            ]),
        ],
        [GSU, CHARLES],
    );

    test("a day's events and services, soonest first, overlapping sites side by side", () => {
        const items = buildDayPlan(ws, FRIDAY);
        expect(items.map((i) => [i.name, i.siteName, i.startLocal])).toEqual([
            ["Server", "George Sherman Union", "11:00"],
            ["Bartender", "Charles Hotel", "16:00"],
            ["Alumni reception", "George Sherman Union", "17:00"],
            ["Bartender", "Charles Hotel", "21:00"],
        ]);
    });

    test("an event's roles keep their own times, and its staffing adds up", () => {
        const reception = buildDayPlan(ws, FRIDAY).find((i) => i.eventId === "evt")!;
        expect(reception.kind).toBe("event");
        expect(reception.blocks.map((b) => [b.shift.role, b.shift.startLocal])).toEqual([
            ["Prep", "14:00"],
            ["Server", "16:30"],
        ]);
        // The event's own hours, not the prep shift's.
        expect([reception.startLocal, reception.endLocal]).toEqual(["17:00", "22:00"]);
        expect([reception.needed, reception.assigned, reception.unfilled]).toEqual([8, 6, 2]);
    });

    test("needs people leaves the fully staffed", () => {
        const needing = buildDayPlan(ws, FRIDAY, { needsPeopleOnly: true });
        expect(needing.map((i) => i.name)).toEqual(["Bartender", "Alumni reception"]);
        expect(needing.every((i) => i.unfilled > 0)).toBe(true);
    });

    test("publication: all draft, all published, or some of each", () => {
        const items = buildDayPlan(ws, FRIDAY);
        expect(items.find((i) => i.siteId === "charles" && i.startLocal === "16:00")!.publication).toBe("draft");
        expect(items.find((i) => i.name === "Alumni reception")!.publication).toBe("published");

        const mixed = mergeWeeks(
            [week(GSU, [shift({ id: "x", assignees: [assignee("ana", "add")] })])],
            [GSU],
        );
        expect(buildDayPlan(mixed, FRIDAY)[0]!.publication).toBe("mixed");
    });

    test("open positions: published ones are open for pickup now, drafts will be once published", () => {
        const items = buildDayPlan(ws, FRIDAY);
        const reception = items.find((i) => i.name === "Alumni reception")!;
        expect([reception.openNow, reception.openLater]).toEqual([2, 0]);
        const draftBar = items.find((i) => i.siteId === "charles" && i.startLocal === "16:00")!;
        expect([draftBar.openNow, draftBar.openLater]).toEqual([0, 3]);
        const edited = mergeWeeks([week(GSU, [shift({ id: "x", capacity: 3, filled: 1, open: 2, hasUnpublishedEdits: true })])], [GSU]);
        expect(buildDayPlan(edited, FRIDAY)[0]).toMatchObject({ openNow: 0, openLater: 2 });
    });

    test("something that disappears at the next publish is not part of the plan", () => {
        const gone = mergeWeeks([week(GSU, [shift({ id: "x", pendingRemoval: true })])], [GSU]);
        expect(buildDayPlan(gone, FRIDAY)).toEqual([]);
    });

    test("an overnight shift says it ends the next day", () => {
        const night = buildDayPlan(ws, FRIDAY).find((i) => i.startLocal === "21:00")!;
        expect(rangeLabel(night)).toBe("9p–2a +1");
        expect(rangeLabel({ startLocal: "11:00", endLocal: "16:00", overnight: false })).toBe("11a–4p");
    });
});

describe("unfilledByDay", () => {
    test("positions and events still needing people, per day", () => {
        const ws = mergeWeeks(
            [
                week(
                    GSU,
                    [
                        shift({ id: "a", eventId: "evt", capacity: 6, filled: 4, open: 2 }),
                        shift({ id: "b", locationId: "gsu", startLocal: "09:00", endLocal: "12:00", capacity: 2, filled: 0, open: 2 }),
                        shift({ id: "c", localDate: "2026-10-13", dayIndex: 2, capacity: 1, filled: 1, open: 0 }),
                    ],
                    [event({})],
                ),
            ],
            [GSU],
        );
        const days = unfilledByDay(ws);
        expect(days[5]).toEqual({ unfilled: 4, events: 2, items: 2 });
        expect(days[2]).toEqual({ unfilled: 0, events: 0, items: 1 });
        expect(days).toHaveLength(7);
    });
});

describe("openShiftsByDay", () => {
    test("shifts with empty positions, in time order, on their own day", () => {
        const ws = mergeWeeks(
            [
                week(GSU, [
                    shift({ id: "late", startLocal: "17:00", endLocal: "23:00", capacity: 2, filled: 1, open: 1 }),
                    shift({ id: "early", startLocal: "11:00", endLocal: "16:00", capacity: 1, filled: 0, open: 1 }),
                    shift({ id: "full", capacity: 1, filled: 1, open: 0 }),
                    shift({ id: "gone", open: 2, pendingRemoval: true }),
                    shift({ id: "tue", localDate: "2026-10-13", dayIndex: 2, open: 1, capacity: 1, filled: 0 }),
                ]),
            ],
            [GSU],
        );
        const days = openShiftsByDay(ws);
        expect(days[5]!.map((s) => s.id)).toEqual(["early", "late"]);
        expect(days[2]!.map((s) => s.id)).toEqual(["tue"]);
        expect(days[0]).toEqual([]);
    });
});

describe("publishScope", () => {
    test("hidden sites with changes are named, not silently included", () => {
        const weeks = [week(GSU, [], [], 4), week(CHARLES, [], [], 2), week({ id: "quiet", name: "Quiet Cafe" }, [], [], 0)];
        const scope = publishScope(weeks, ["gsu"]);
        expect(scope.included.map((s) => [s.site.id, s.pending])).toEqual([["gsu", 4]]);
        expect(scope.excluded.map((s) => [s.site.id, s.pending])).toEqual([["charles", 2]]);
    });
});
