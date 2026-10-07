import { describe, expect, test } from "bun:test";
import type { SchedulerShift, SchedulerWeek } from "@repo/contracts/scheduler";
import { compactRange, compactTime, formatHours, addDays, weekRangeLabel, weekdayShort } from "./format";
import { roleColor } from "./role-color";
import { ALL_DEPARTMENTS, NO_DEPARTMENT, buildPeopleView, hoursTone } from "./view-model";

const shift = (over: Partial<SchedulerShift>): SchedulerShift => ({
    id: "s",
    locationId: "loc",
    dayIndex: 0,
    localDate: "2026-09-27",
    startLocal: "09:00",
    endLocal: "17:00",
    overnight: false,
    startsAt: "2026-09-27T13:00:00.000Z",
    endsAt: "2026-09-27T21:00:00.000Z",
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

const person = (id: string, name: string, primaryRole: string | null, departmentId: string | null, minutes = 0) => ({
    id,
    kind: "active" as const,
    name,
    initials: name.slice(0, 2).toUpperCase(),
    roles: primaryRole ? [primaryRole] : [],
    primaryRole,
    departmentId,
    agencyName: null,
    scheduledMinutes: minutes,
    overtimeMinutes: 0,
});

const week = (): SchedulerWeek => ({
    location: { id: "loc", name: "Downtown", timezone: "America/New_York" },
    weekStart: "2026-09-27",
    weekStartsOn: 0,
    days: Array.from({ length: 7 }, (_, i) => ({ index: i, localDate: addDays("2026-09-27", i), isToday: i === 2 })),
    settings: { overtimePolicy: "weekly_40", scheduleStyle: "steady", openShiftClaimPolicy: "approval" },
    departments: [
        { id: "foh", name: "Front of house", roles: ["Server", "Host"] },
        { id: "boh", name: "Kitchen", roles: ["Line Cook"] },
    ],
    people: [
        person("ben", "Ben Kim", "Server", "foh", 600),
        person("ana", "Ana Ruiz", "Host", "foh", 450),
        person("cy", "Cy Lo", "Line Cook", "boh"),
        person("dee", "Dee Ray", "Florist", null),
    ],
    shifts: [
        shift({ id: "mon-open", dayIndex: 1, role: "Server", capacity: 3, filled: 1, open: 2, assignees: [{ personId: "ben", kind: "active", pendingState: null, warnings: [] }] }),
        shift({ id: "tue-cook", dayIndex: 2, role: "Line Cook", capacity: 1, filled: 0, open: 1 }),
        shift({ id: "tue-late", dayIndex: 2, startLocal: "16:00", endLocal: "23:00", assignees: [{ personId: "ana", kind: "active", pendingState: "add", warnings: [] }] }),
        shift({ id: "tue-early", dayIndex: 2, startLocal: "07:00", endLocal: "11:00", assignees: [{ personId: "ana", kind: "active", pendingState: null, warnings: [] }] }),
        shift({ id: "gone", dayIndex: 3, open: 4, capacity: 4, filled: 0, pendingRemoval: true }),
    ],
    events: [],
    timeOff: [
        {
            id: "t1",
            personId: "cy",
            status: "pending",
            allDay: true,
            reason: null,
            startsAt: "2026-09-29T04:00:00.000Z",
            endsAt: "2026-09-30T04:00:00.000Z",
            spans: [{ dayIndex: 2, startLocal: "00:00", endLocal: "24:00", wholeDay: true }],
        },
    ],
    unavailable: [],
    summary: { openSlots: 3, pendingChangeCount: 1, pendingRequestCount: 0 },
});

describe("format", () => {
    test("compact times read like a paper schedule", () => {
        expect(["09:00", "17:30", "00:00", "12:00", "24:00", "12:15"].map(compactTime)).toEqual(["9a", "5:30p", "12a", "12p", "12a", "12:15p"]);
        expect(compactRange("16:00", "23:00")).toBe("4p–11p");
    });

    test("hours drop a trailing .0", () => {
        expect([390, 2400, 20, 0].map(formatHours)).toEqual(["6.5h", "40h", "0.3h", "0h"]);
    });

    test("dates move across month and year ends without timezones", () => {
        expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
        expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
        expect(weekdayShort("2026-09-27")).toBe("Sun");
        expect(weekRangeLabel("2026-09-27", "2026-10-03", "2026-09-29")).toBe("Sep 27 – Oct 3");
        expect(weekRangeLabel("2026-09-06", "2026-09-12", "2026-09-29")).toBe("Sep 6 – 12");
        expect(weekRangeLabel("2026-12-27", "2027-01-02", "2026-09-29")).toBe("Dec 27 – Jan 2, 2027");
    });

    test("role colours are stable and fall back to a palette", () => {
        expect(roleColor("Line Cook")).toBe("var(--role-kitchen)");
        expect(roleColor("Cashier")).toBe(roleColor("cashier"));
        expect(roleColor(null)).toBe("var(--role-default)");
    });
});

describe("buildPeopleView", () => {
    test("groups people by department, in the department's role order, with an Other section last", () => {
        const view = buildPeopleView(week(), { department: ALL_DEPARTMENTS, search: "" });
        // Front of house lists Server before Host, so Ben (Server) leads Ana (Host).
        expect(view.sections.map((s) => [s.id, s.people.map((p) => p.person.id)])).toEqual([
            ["foh", ["ben", "ana"]],
            ["boh", ["cy"]],
            [NO_DEPARTMENT, ["dee"]],
        ]);
        expect(view.sections[0]!.scheduledMinutes).toBe(1050);
    });

    test("puts each person's shifts on their days, earliest first", () => {
        const view = buildPeopleView(week(), { department: ALL_DEPARTMENTS, search: "" });
        const ana = view.sections[0]!.people.find((p) => p.person.id === "ana")!;
        expect(ana.days[2]!.shifts.map((s) => [s.shift.id, s.assignee.pendingState])).toEqual([
            ["tue-early", null],
            ["tue-late", "add"],
        ]);
        const cy = view.sections[1]!.people[0]!;
        expect(cy.days[2]!.timeOff).toEqual([{ id: "t1", status: "pending", span: expect.objectContaining({ wholeDay: true }), reason: null }]);
    });

    test("the Open row and section counts ignore shifts being removed", () => {
        const view = buildPeopleView(week(), { department: ALL_DEPARTMENTS, search: "" });
        expect(view.open.map((d) => d.map((s) => s.id))).toEqual([[], ["mon-open"], ["tue-cook"], [], [], [], []]);
        expect(view.sections.map((s) => s.openSlots)).toEqual([2, 1, 0]);
    });

    test("a department filter narrows people and the Open row together", () => {
        const view = buildPeopleView(week(), { department: "boh", search: "" });
        expect(view.sections.map((s) => s.id)).toEqual(["boh"]);
        expect(view.open.flat().map((s) => s.id)).toEqual(["tue-cook"]);
        expect(view.visibleCount).toBe(1);
    });

    test("search filters names but keeps the Open row", () => {
        const view = buildPeopleView(week(), { department: ALL_DEPARTMENTS, search: " BEN " });
        expect(view.sections.flatMap((s) => s.people.map((p) => p.person.id))).toEqual(["ben"]);
        expect(view.open.flat()).toHaveLength(2);
    });
});

describe("hoursTone", () => {
    test("near in the last four hours before 40, over once overtime starts", () => {
        expect(hoursTone({ scheduledMinutes: 2100, overtimeMinutes: 0 }, "weekly_40")).toBe("normal");
        expect(hoursTone({ scheduledMinutes: 2200, overtimeMinutes: 0 }, "weekly_40")).toBe("near");
        expect(hoursTone({ scheduledMinutes: 2500, overtimeMinutes: 100 }, "weekly_40")).toBe("over");
        expect(hoursTone({ scheduledMinutes: 2300, overtimeMinutes: 0 }, "daily_8")).toBe("normal");
    });
});
