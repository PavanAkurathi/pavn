import { describe, expect, test } from "bun:test";
import type { SchedulerShift, SchedulerWeek } from "@repo/contracts/scheduler";
import {
    buildDay,
    commonRanges,
    coverageText,
    dayCoverage,
    isLocked,
    partOfDay,
    publishableChanges,
    weekCoverage,
    weekIssues,
} from "./day-model";
import { addDays, dayHeading, firstNameOf, weekdayLong } from "./format";

const assignee = (
    personId: string,
    over: Partial<{ pendingState: "add" | "remove" | null; warnings: { type: "overlap" | "overtime" | "time_off"; severity: "block" | "warn"; message: string }[] }> = {},
) => ({ personId, kind: "roster" as const, pendingState: null, warnings: [], ...over });

const shift = (over: Partial<SchedulerShift>): SchedulerShift => ({
    id: "s",
    locationId: "loc",
    dayIndex: 3,
    localDate: "2026-09-30",
    startLocal: "07:00",
    endLocal: "15:00",
    overnight: false,
    startsAt: "2026-09-30T11:00:00.000Z",
    endsAt: "2026-09-30T19:00:00.000Z",
    role: "Server",
    breakMinutes: 30,
    paidMinutes: 450,
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

const person = (id: string, name: string, roles = ["Server"], departmentId: string | null = null) => ({
    id,
    kind: "roster" as const,
    name,
    initials: name.slice(0, 2),
    roles,
    primaryRole: roles[0] ?? null,
    departmentId,
    agencyName: null,
    scheduledMinutes: 0,
    overtimeMinutes: 0,
});

const week = (shifts: SchedulerShift[], over: Partial<SchedulerWeek> = {}): SchedulerWeek => ({
    location: { id: "loc", name: "Cafe", timezone: "America/New_York" },
    weekStart: "2026-09-27",
    weekStartsOn: 0,
    days: Array.from({ length: 7 }, (_, i) => ({ index: i, localDate: addDays("2026-09-27", i), isToday: i === 3 })),
    settings: { overtimePolicy: "weekly_40", scheduleStyle: "steady", openShiftClaimPolicy: "approval" },
    departments: [],
    people: [person("ana", "Ana Ruiz"), person("ben", "Ben Kim"), person("cy", "Cy Lo", ["Line Cook"])],
    shifts,
    events: [],
    timeOff: [],
    unavailable: [],
    summary: { openSlots: 0, pendingChangeCount: 0, pendingRequestCount: 0 },
    ...over,
});

const doubleBooked = { type: "overlap" as const, severity: "block" as const, message: "Already on Wed 12p–6p" };
const nearOvertime = { type: "overtime" as const, severity: "warn" as const, message: "Would be at 44h" };

describe("partOfDay", () => {
    test("uses the start time, with the boundaries on the hour", () => {
        expect(partOfDay("06:00")).toBe("morning");
        expect(partOfDay("10:59")).toBe("morning");
        expect(partOfDay("11:00")).toBe("afternoon");
        expect(partOfDay("15:59")).toBe("afternoon");
        expect(partOfDay("16:00")).toBe("evening");
        expect(partOfDay("23:30")).toBe("evening");
    });
});

describe("dayCoverage", () => {
    test("an empty day is empty", () => {
        expect(dayCoverage(week([]), 3)).toMatchObject({ status: "empty", needed: 0, open: 0 });
    });

    test("a full day is covered", () => {
        const w = week([shift({ assignees: [assignee("ana")] })]);
        expect(dayCoverage(w, 3)).toMatchObject({ status: "covered", needed: 1, filled: 1, open: 0 });
    });

    test("open spots make the day need someone", () => {
        const w = week([shift({ capacity: 3, filled: 1, open: 2, assignees: [assignee("ana")] })]);
        expect(dayCoverage(w, 3)).toMatchObject({ status: "needs", needed: 3, filled: 1, open: 2 });
    });

    test("a real conflict beats open spots", () => {
        const w = week([
            shift({ id: "a", assignees: [assignee("ana", { warnings: [doubleBooked] })] }),
            shift({ id: "b", capacity: 2, filled: 0, open: 2 }),
        ]);
        const c = dayCoverage(w, 3);
        expect(c.status).toBe("problem");
        expect(c.problems).toBe(1);
        expect(c.open).toBe(2);
    });

    test("soft warnings are heads-ups, not problems", () => {
        const w = week([shift({ assignees: [assignee("ana", { warnings: [nearOvertime] })] })]);
        expect(dayCoverage(w, 3)).toMatchObject({ status: "covered", problems: 0, headsUps: 1 });
    });

    test("ignores shifts that go away on publish and people coming off", () => {
        const w = week([
            shift({ id: "gone", pendingRemoval: true, capacity: 2, filled: 0, open: 2 }),
            shift({ id: "off", assignees: [assignee("ana", { pendingState: "remove", warnings: [doubleBooked] })] }),
        ]);
        expect(dayCoverage(w, 3)).toMatchObject({ open: 0, problems: 0 });
    });

    test("counts only the department in view", () => {
        const w = week(
            [
                shift({ id: "cook", role: "Line Cook", capacity: 1, filled: 0, open: 1 }),
                shift({ id: "srv", role: "Server", assignees: [assignee("ana")] }),
            ],
            { departments: [{ id: "foh", name: "Front", roles: ["Server"] }, { id: "boh", name: "Kitchen", roles: ["Line Cook"] }] },
        );
        expect(dayCoverage(w, 3, { department: "foh" }).status).toBe("covered");
        expect(dayCoverage(w, 3, { department: "boh" }).status).toBe("needs");
        expect(dayCoverage(w, 3).open).toBe(1);
    });

    test("an overnight shift belongs to the day it starts", () => {
        const w = week([shift({ startLocal: "22:00", endLocal: "06:00", overnight: true, assignees: [assignee("ana")] })]);
        expect(dayCoverage(w, 3).status).toBe("covered");
        expect(dayCoverage(w, 4).status).toBe("empty");
    });

    test("the open count over a week matches the server's summary", () => {
        const shifts = [
            shift({ id: "a", dayIndex: 1, capacity: 2, filled: 0, open: 2 }),
            shift({ id: "b", dayIndex: 4, capacity: 3, filled: 1, open: 2, assignees: [assignee("ana")] }),
            shift({ id: "c", dayIndex: 5, pendingRemoval: true, capacity: 5, filled: 0, open: 5 }),
        ];
        const w = week(shifts, { summary: { openSlots: 4, pendingChangeCount: 0, pendingRequestCount: 0 } });
        const total = weekCoverage(w).reduce((sum, c) => sum + c.open, 0);
        expect(total).toBe(w.summary.openSlots);
    });
});

describe("buildDay", () => {
    test("groups by part of day, needed first, then people by start time", () => {
        const w = week([
            shift({ id: "eve", startLocal: "17:00", endLocal: "23:00", assignees: [assignee("ben")] }),
            shift({ id: "am2", startLocal: "08:00", assignees: [assignee("ben")] }),
            shift({ id: "am1", startLocal: "07:00", assignees: [assignee("ana")] }),
            shift({ id: "open", startLocal: "07:30", capacity: 2, filled: 0, open: 2 }),
        ]);
        const day = buildDay(w, 3);
        expect(day.groups.map((g) => g.part)).toEqual(["morning", "evening"]);
        const morning = day.groups[0]!;
        expect(morning.needed.map((n) => [n.shift.id, n.open])).toEqual([["open", 2]]);
        expect(morning.people.map((p) => p.shift.id)).toEqual(["am1", "am2"]);
        expect(day.working).toBe(2);
        expect(day.open).toBe(2);
        expect(day.paidMinutes).toBe(450 * 3);
    });

    test("hides empty parts and other days", () => {
        const w = week([shift({ id: "mon", dayIndex: 1, assignees: [assignee("ana")] })]);
        expect(buildDay(w, 3).groups).toEqual([]);
        expect(buildDay(w, 1).groups.map((g) => g.part)).toEqual(["morning"]);
    });

    test("keeps people who are coming off, but does not count them as working", () => {
        const w = week([shift({ assignees: [assignee("ana", { pendingState: "remove" })] })]);
        const day = buildDay(w, 3);
        expect(day.groups[0]!.people).toHaveLength(1);
        expect(day.working).toBe(0);
    });

    test("search finds people by name and open spots by role", () => {
        const w = week([
            shift({ id: "a", assignees: [assignee("ana")] }),
            shift({ id: "b", assignees: [assignee("ben")] }),
            shift({ id: "cook", role: "Line Cook", capacity: 1, filled: 0, open: 1 }),
        ]);
        const byName = buildDay(w, 3, { search: "ana" });
        expect(byName.groups[0]!.people.map((p) => p.person?.name)).toEqual(["Ana Ruiz"]);
        expect(byName.open).toBe(0);
        const byRole = buildDay(w, 3, { search: "cook" });
        expect(byRole.open).toBe(1);
    });

    test("says who is away in words", () => {
        const w = week([], {
            timeOff: [
                {
                    id: "t1",
                    personId: "ben",
                    status: "approved",
                    allDay: true,
                    reason: null,
                    startsAt: "2026-09-30T04:00:00.000Z",
                    endsAt: "2026-10-01T03:59:00.000Z",
                    spans: [{ dayIndex: 3, startLocal: "00:00", endLocal: "24:00", wholeDay: true }],
                },
                {
                    id: "t2",
                    personId: "ana",
                    status: "pending",
                    allDay: false,
                    reason: null,
                    startsAt: "2026-09-30T18:00:00.000Z",
                    endsAt: "2026-09-30T22:00:00.000Z",
                    spans: [{ dayIndex: 3, startLocal: "14:00", endLocal: "18:00", wholeDay: false }],
                },
            ],
            unavailable: [
                {
                    id: "u1",
                    personId: "cy",
                    startsAt: "2026-09-30T20:00:00.000Z",
                    endsAt: "2026-09-30T23:00:00.000Z",
                    spans: [{ dayIndex: 3, startLocal: "16:00", endLocal: "19:00", wholeDay: false }],
                },
            ],
        });
        expect(buildDay(w, 3).away.map((a) => a.text)).toEqual(["Ben off all day", "Ana asked for time off", "Cy unavailable 4p–7p"]);
        expect(buildDay(w, 2).away).toEqual([]);
    });
});

describe("weekIssues", () => {
    test("lists warnings worst first and finds the first day to look at", () => {
        const w = week([
            shift({ id: "a", dayIndex: 1, assignees: [assignee("ana", { warnings: [nearOvertime] })] }),
            shift({ id: "b", dayIndex: 3, assignees: [assignee("ben", { warnings: [doubleBooked] })] }),
            shift({ id: "c", dayIndex: 2, capacity: 1, filled: 0, open: 1 }),
        ]);
        const issues = weekIssues(w);
        expect(issues.issues.map((i) => [i.personName, i.warning.severity])).toEqual([
            ["Ben Kim", "block"],
            ["Ana Ruiz", "warn"],
        ]);
        expect(issues.blocking).toBe(1);
        expect(issues.firstDayWithOpen).toBe(2);
        expect(issues.firstDayWithProblem).toBe(3);
    });

    test("finds nothing on a quiet week", () => {
        expect(weekIssues(week([shift({ assignees: [assignee("ana")] })]))).toMatchObject({
            issues: [],
            blocking: 0,
            firstDayWithOpen: null,
            firstDayWithProblem: null,
        });
    });
});

describe("words", () => {
    test("coverageText puts the most urgent thing first", () => {
        const base = { dayIndex: 0, needed: 0, filled: 0, open: 0, problems: 0, headsUps: 0, events: 0 };
        expect(coverageText({ ...base, status: "empty" }).short).toBe("Nothing yet");
        expect(coverageText({ ...base, status: "covered", needed: 2, filled: 2 }).short).toBe("All set");
        expect(coverageText({ ...base, status: "needs", open: 3 }).short).toBe("3 open");
        const both = coverageText({ ...base, status: "problem", problems: 1, open: 2 });
        expect(both.short).toBe("1 to check");
        expect(both.long).toBe("1 to check, 2 spots open");
    });

    test("dates read like a person would say them", () => {
        expect(weekdayLong("2026-09-30")).toBe("Wednesday");
        expect(dayHeading("2026-10-01")).toBe("Thursday, Oct 1");
        expect(firstNameOf("Sam Wu")).toBe("Sam");
        expect(firstNameOf(null)).toBe("Someone");
    });

    test("started, done and approved shifts are locked", () => {
        for (const status of ["in-progress", "completed", "approved", "cancelled"] as const) {
            expect(isLocked({ status })).toBe(true);
        }
        for (const status of ["draft", "published", "open", "assigned"] as const) {
            expect(isLocked({ status })).toBe(false);
        }
    });
});

describe("commonRanges", () => {
    test("most used times first, ignoring shifts that are going away", () => {
        const w = week([
            shift({ id: "a", startLocal: "16:00", endLocal: "23:00" }),
            shift({ id: "b", startLocal: "16:00", endLocal: "23:00" }),
            shift({ id: "c", startLocal: "07:00", endLocal: "15:00" }),
            shift({ id: "d", startLocal: "09:00", endLocal: "17:00", pendingRemoval: true }),
        ]);
        expect(commonRanges(w)).toEqual([
            { startLocal: "16:00", endLocal: "23:00" },
            { startLocal: "07:00", endLocal: "15:00" },
        ]);
        expect(commonRanges(w, 1)).toHaveLength(1);
    });
});

describe("publishableChanges", () => {
    const now = Date.parse("2026-09-30T15:00:00.000Z");
    const past = { startsAt: "2026-09-28T20:00:00.000Z", endsAt: "2026-09-29T03:00:00.000Z" };
    const future = { startsAt: "2026-10-01T20:00:00.000Z", endsAt: "2026-10-02T03:00:00.000Z" };

    test("counts new drafts that haven't ended, edits to shared shifts, and removals", () => {
        const w = week([
            shift({ id: "new", status: "draft", ...future }),
            shift({ id: "edited", hasUnpublishedEdits: true, ...future }),
            shift({ id: "going", pendingRemoval: true, ...future }),
            shift({ id: "staged", assignees: [assignee("ana", { pendingState: "add" })], ...future }),
            shift({ id: "quiet", ...future }),
        ]);
        expect(publishableChanges(w, now)).toBe(4);
    });

    test("ignores drafts that already ended, because publishing skips them", () => {
        const w = week([shift({ id: "old", status: "draft", ...past }), shift({ id: "new", status: "draft", ...future })]);
        expect(publishableChanges(w, now)).toBe(1);
    });

    test("a quiet week has nothing to publish", () => {
        expect(publishableChanges(week([shift({ ...future })]), now)).toBe(0);
        expect(publishableChanges(week([]), now)).toBe(0);
    });
});
