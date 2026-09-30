import { describe, expect, test } from "bun:test";
import type { SchedulerShift, SchedulerWeek } from "@repo/contracts/scheduler";
import { groupCandidates, rankCandidates } from "./candidates";
import { addDays } from "./format";
import {
    planAddPerson,
    planCopyWeek,
    planCreate,
    planMove,
    planRemove,
    planCopyToDays,
    planSetNeeded,
    planTakeOff,
    planTemplate,
    withoutPeople,
} from "./plans";

const assignee = (personId: string, pendingState: "add" | "remove" | null = null) => ({
    personId,
    kind: "roster" as const,
    pendingState,
    warnings: [],
});

const shift = (over: Partial<SchedulerShift>): SchedulerShift => ({
    id: "s",
    locationId: "loc",
    dayIndex: 1,
    localDate: "2026-09-28",
    startLocal: "16:00",
    endLocal: "23:00",
    overnight: false,
    startsAt: "2026-09-28T20:00:00.000Z",
    endsAt: "2026-09-29T03:00:00.000Z",
    role: "Server",
    breakMinutes: 30,
    paidMinutes: 390,
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

const person = (id: string, name: string, roles = ["Server"], minutes = 0) => ({
    id,
    kind: "roster" as const,
    name,
    initials: "",
    roles,
    primaryRole: roles[0] ?? null,
    departmentId: null,
    agencyName: null,
    scheduledMinutes: minutes,
    overtimeMinutes: 0,
});

const week = (shifts: SchedulerShift[]): SchedulerWeek => ({
    location: { id: "loc", name: "Downtown", timezone: "America/New_York" },
    weekStart: "2026-09-27",
    weekStartsOn: 0,
    days: Array.from({ length: 7 }, (_, i) => ({ index: i, localDate: addDays("2026-09-27", i), isToday: false })),
    settings: { overtimePolicy: "weekly_40", scheduleStyle: "steady", openShiftClaimPolicy: "approval" },
    departments: [],
    people: [person("ana", "Ana Ruiz"), person("ben", "Ben Kim", ["Server"], 2300), person("cy", "Cy Lo", ["Line Cook"])],
    shifts,
    events: [],
    timeOff: [],
    unavailable: [],
    summary: { openSlots: 0, pendingChangeCount: 0, pendingRequestCount: 0 },
});

const ops = (plan: { changes: { op: string }[] } | null) => plan?.changes.map((c) => c.op);

describe("planMove", () => {
    test("a one-person shift moves whole to another day and person", () => {
        const w = week([shift({ id: "mon", assignees: [assignee("ana")] })]);
        const plan = planMove(w, { kind: "assignment", shiftId: "mon", personId: "ana" }, { personId: "ben", dayIndex: 3 }, { copy: false });
        expect(plan!.changes).toEqual([
            { op: "update", shiftId: "mon", patch: { localDate: "2026-09-30" } },
            { op: "assign", shiftId: "mon", assignees: [{ personId: "ben", kind: "roster" }] },
        ]);
        expect(plan!.label).toBe("Moved 4p–11p to Ben on Wed");
    });

    test("leaving a group shift takes the spot along; copying leaves it", () => {
        const w = week([shift({ id: "mon", capacity: 3, filled: 2, open: 1, assignees: [assignee("ana"), assignee("ben")] })]);
        const move = planMove(w, { kind: "assignment", shiftId: "mon", personId: "ana" }, { personId: "ana", dayIndex: 2 }, { copy: false });
        expect(ops(move)).toEqual(["create", "assign", "update"]);
        expect(move!.changes[2]).toEqual({ op: "update", shiftId: "mon", patch: { capacity: 2 } });

        const copy = planMove(w, { kind: "assignment", shiftId: "mon", personId: "ana" }, { personId: "ana", dayIndex: 2 }, { copy: true });
        expect(ops(copy)).toEqual(["create"]);
        expect(copy!.label).toBe("Copied 4p–11p to Ana on Tue");
    });

    test("joins a matching shift on the target day instead of making another", () => {
        const w = week([
            shift({ id: "mon", assignees: [assignee("ana")] }),
            shift({ id: "tue", dayIndex: 2, localDate: "2026-09-29", assignees: [assignee("ben")] }),
        ]);
        const plan = planMove(w, { kind: "assignment", shiftId: "mon", personId: "ana" }, { personId: "cy", dayIndex: 2 }, { copy: true });
        expect(plan!.changes).toEqual([
            { op: "update", shiftId: "tue", patch: { capacity: 2 } },
            { op: "assign", shiftId: "tue", assignees: [{ personId: "ben", kind: "roster" }, { personId: "cy", kind: "roster" }] },
        ]);
    });

    test("dropping on the Open row the same day takes the person off and keeps the spot", () => {
        const w = week([shift({ id: "mon", assignees: [assignee("ana")] })]);
        const plan = planMove(w, { kind: "assignment", shiftId: "mon", personId: "ana" }, { personId: null, dayIndex: 1 }, { copy: false });
        expect(plan).toEqual({ changes: [{ op: "assign", shiftId: "mon", assignees: [] }], label: "Took Ana off 4p–11p" });
    });

    test("dragging an open spot onto someone fills it", () => {
        const w = week([shift({ id: "mon", capacity: 2, filled: 1, open: 1, assignees: [assignee("ana")] })]);
        const plan = planMove(w, { kind: "open", shiftId: "mon" }, { personId: "ben", dayIndex: 1 }, { copy: false });
        expect(plan!.changes).toEqual([
            { op: "assign", shiftId: "mon", assignees: [{ personId: "ana", kind: "roster" }, { personId: "ben", kind: "roster" }] },
        ]);
    });

    test("nothing to do when dropping where it already is", () => {
        const w = week([shift({ id: "mon", assignees: [assignee("ana")] })]);
        expect(planMove(w, { kind: "assignment", shiftId: "mon", personId: "ana" }, { personId: "ana", dayIndex: 1 }, { copy: false })).toBeNull();
        expect(planMove(w, { kind: "open", shiftId: "mon" }, { personId: null, dayIndex: 1 }, { copy: false })).toBeNull();
    });

    test("people staged to come off don't count", () => {
        const w = week([shift({ id: "mon", capacity: 2, assignees: [assignee("ana"), assignee("ben", "remove")] })]);
        const plan = planMove(w, { kind: "assignment", shiftId: "mon", personId: "ana" }, { personId: "cy", dayIndex: 1 }, { copy: false });
        expect(plan!.changes).toEqual([{ op: "assign", shiftId: "mon", assignees: [{ personId: "cy", kind: "roster" }] }]);
    });
});

describe("planRemove", () => {
    test("a person's own shift is deleted; a group shift keeps the open spot", () => {
        const solo = week([shift({ id: "mon", assignees: [assignee("ana")] })]);
        expect(planRemove(solo, { kind: "assignment", shiftId: "mon", personId: "ana" })!.changes).toEqual([{ op: "delete", shiftId: "mon" }]);

        const group = week([shift({ id: "mon", capacity: 2, assignees: [assignee("ana"), assignee("ben")] })]);
        expect(planRemove(group, { kind: "assignment", shiftId: "mon", personId: "ana" })!.changes).toEqual([
            { op: "assign", shiftId: "mon", assignees: [{ personId: "ben", kind: "roster" }] },
        ]);
    });

    test("open spots are dropped, or the shift when nobody is on it", () => {
        const partly = week([shift({ id: "mon", capacity: 3, filled: 1, open: 2, assignees: [assignee("ana")] })]);
        expect(planRemove(partly, { kind: "open", shiftId: "mon" })).toMatchObject({
            changes: [{ op: "update", shiftId: "mon", patch: { capacity: 1 } }],
            label: "Dropped 2 open Server spots",
        });
        const empty = week([shift({ id: "mon", capacity: 2, filled: 0, open: 2 })]);
        expect(ops(planRemove(empty, { kind: "open", shiftId: "mon" }))).toEqual(["delete"]);
    });
});

describe("planning new shifts", () => {
    test("quick create for a person or open spots", () => {
        const w = week([]);
        const mine = planCreate({ week: w, dayIndex: 0, person: w.people[0]!, startLocal: "09:00", endLocal: "17:00", role: "Server" });
        expect(mine.changes[0]).toMatchObject({
            op: "create",
            shift: { localDate: "2026-09-27", capacity: 1, role: "Server" },
            assignees: [{ personId: "ana", kind: "roster" }],
        });
        expect(planCreate({ week: w, dayIndex: 0, person: null, startLocal: "09:00", endLocal: "17:00", role: "Host", capacity: 3 }).label).toBe(
            "Added 3 open Host spots",
        );
    });

    test("copying a week keeps weekdays and wall-clock times, with or without people", () => {
        const last = { ...week([shift({ id: "a", assignees: [assignee("ana")] }), shift({ id: "gone", pendingRemoval: true })]), weekStart: "2026-09-20" };
        const next = week([]);
        const withPeople = planCopyWeek(last, next, true);
        expect(withPeople.changes).toHaveLength(1);
        expect(withPeople.changes[0]).toMatchObject({ shift: { localDate: "2026-09-28", startLocal: "16:00" }, assignees: [{ personId: "ana" }] });
        expect(planCopyWeek(last, next, false).changes[0]).toMatchObject({ assignees: [] });
    });

    test("a template adds each position on each chosen day", () => {
        const plan = planTemplate(week([]), { name: "Dinner", startTime: "16:00", endTime: "23:00", positions: [{ roleName: "Server", headcount: 3 }, { roleName: "Host", headcount: 1 }] }, [5, 6]);
        expect(plan.changes).toHaveLength(4);
        expect(plan.label).toBe("Added Dinner on 2 days");
    });

    test("people with conflicts can be taken off a plan, leaving their spots open", () => {
        const plan = planCopyWeek({ ...week([shift({ id: "a", capacity: 2, assignees: [assignee("ana"), assignee("ben")] })]) }, week([]), true);
        const created = plan.changes[0] as { shiftId: string };
        const trimmed = withoutPeople(plan.changes, [{ shiftId: created.shiftId, personId: "ben" }]);
        expect(trimmed[0]).toMatchObject({ shift: { capacity: 2 }, assignees: [{ personId: "ana" }] });
    });
});

describe("rankCandidates", () => {
    test("trained and free first, with reasons for everyone else", () => {
        const target = shift({ id: "mon", capacity: 2, open: 2, filled: 0 });
        const w = week([target, shift({ id: "busy", startLocal: "18:00", endLocal: "22:00", startsAt: "2026-09-28T22:00:00.000Z", endsAt: "2026-09-29T02:00:00.000Z", assignees: [assignee("ana")] })]);
        const ranked = rankCandidates(w, target);
        expect(ranked.map((c) => [c.person.id, c.blocked, c.reasons])).toEqual([
            ["ben", false, ["Would be at 44.8h"]],
            ["cy", false, ["Not set up as Server"]],
            ["ana", true, ["Already on Mon 6p–10p"]],
        ]);
    });
});

describe("groupCandidates", () => {
    test("cuts the ranked list into good fit, worth a look, and can't work then", () => {
        const target = shift({ id: "mon", capacity: 2, open: 2, filled: 0 });
        const w = {
            ...week([target, shift({ id: "busy", startLocal: "18:00", endLocal: "22:00", startsAt: "2026-09-28T22:00:00.000Z", endsAt: "2026-09-29T02:00:00.000Z", assignees: [assignee("ana")] })]),
        };
        w.people = [...w.people, person("dee", "Dee Fox", ["Server"], 0)];
        const groups = groupCandidates(rankCandidates(w, target));
        expect(groups.good.map((c) => c.person.id)).toEqual(["dee"]);
        expect(groups.maybe.map((c) => c.person.id)).toEqual(["ben", "cy"]);
        expect(groups.blocked.map((c) => c.person.id)).toEqual(["ana"]);
    });
});

describe("events", () => {
    const withEvent = (shifts: SchedulerShift[]) => ({
        ...week(shifts),
        events: [{ id: "evt", name: "Wedding", dayIndex: 6, localDate: "2026-10-03", startLocal: "15:00", endLocal: "23:00", startsAt: "", endsAt: "", notes: null, needed: 8, filled: 0 }],
    });

    test("an event comes with one open shift per role", async () => {
        const { planCreateEvent } = await import("./plans");
        const plan = planCreateEvent(week([]), { name: "Wedding", dayIndex: 6, startLocal: "15:00", endLocal: "23:00", notes: null }, [
            { role: "Server", count: 8 },
            { role: "Bartender", count: 2 },
            { role: " ", count: 3 },
        ]);
        expect(plan.changes.map((c) => c.op)).toEqual(["createEvent", "create", "create"]);
        const eventId = (plan.changes[0] as { eventId: string }).eventId;
        expect(eventId).toMatch(/^evt_[0-9A-Za-z]{16}$/);
        expect(plan.changes[1]).toMatchObject({ shift: { role: "Server", capacity: 8, eventId, localDate: "2026-10-03" } });
    });

    test("moving an event moves its shifts; ones with their own hours keep them", async () => {
        const { planUpdateEvent } = await import("./plans");
        const w = withEvent([
            shift({ id: "srv", dayIndex: 6, localDate: "2026-10-03", startLocal: "15:00", endLocal: "23:00", eventId: "evt" }),
            shift({ id: "setup", dayIndex: 6, localDate: "2026-10-03", startLocal: "12:00", endLocal: "15:00", eventId: "evt" }),
        ]);
        const plan = planUpdateEvent(w, "evt", { name: "Wedding", dayIndex: 5, startLocal: "16:00", endLocal: "23:00", notes: null });
        expect(plan!.changes).toEqual([
            { op: "updateEvent", eventId: "evt", patch: { localDate: "2026-10-02", startLocal: "16:00" } },
            { op: "update", shiftId: "srv", patch: { localDate: "2026-10-02", startLocal: "16:00" } },
            { op: "update", shiftId: "setup", patch: { localDate: "2026-10-02" } },
        ]);
    });

    test("deleting an event can take its shifts with it", async () => {
        const { planDeleteEvent } = await import("./plans");
        const w = withEvent([shift({ id: "srv", dayIndex: 6, eventId: "evt" })]);
        expect(planDeleteEvent(w, "evt", true)!.changes.map((c) => c.op)).toEqual(["delete", "deleteEvent"]);
        expect(planDeleteEvent(w, "evt", false)!.changes.map((c) => c.op)).toEqual(["deleteEvent"]);
    });
});

describe("tap-first plans", () => {
    test("adding to a full shift grows it by one spot first", () => {
        const w = week([shift({ id: "mon", capacity: 1, assignees: [assignee("ana")] })]);
        const plan = planAddPerson(w, "mon", w.people.find((p) => p.id === "ben")!);
        expect(plan!.changes).toEqual([
            { op: "update", shiftId: "mon", patch: { capacity: 2 } },
            { op: "assign", shiftId: "mon", assignees: [{ personId: "ana", kind: "roster" }, { personId: "ben", kind: "roster" }] },
        ]);
        expect(plan!.label).toBe("Added Ben to Mon 4p–11p");
    });

    test("adding to an open spot only assigns", () => {
        const w = week([shift({ id: "mon", capacity: 2, filled: 1, open: 1, assignees: [assignee("ana")] })]);
        const plan = planAddPerson(w, "mon", w.people.find((p) => p.id === "ben")!);
        expect(plan!.changes.map((c) => c.op)).toEqual(["assign"]);
    });

    test("nobody is added twice, and nothing is added to a shift that is going away", () => {
        const w = week([
            shift({ id: "mon", assignees: [assignee("ana")] }),
            shift({ id: "gone", pendingRemoval: true }),
        ]);
        expect(planAddPerson(w, "mon", w.people.find((p) => p.id === "ana")!)).toBeNull();
        expect(planAddPerson(w, "gone", w.people.find((p) => p.id === "ben")!)).toBeNull();
    });

    test("taking someone off keeps the spot so it shows as needed", () => {
        const w = week([shift({ id: "mon", assignees: [assignee("ana")] })]);
        expect(planTakeOff(w, "mon", "ana")).toEqual({
            changes: [{ op: "assign", shiftId: "mon", assignees: [] }],
            label: "Took Ana off Mon 4p–11p",
        });
        expect(planTakeOff(w, "mon", "ben")).toBeNull();
    });

    test("how many people never drops below who is already on it, or below one", () => {
        const w = week([shift({ id: "mon", capacity: 3, filled: 2, open: 1, assignees: [assignee("ana"), assignee("ben")] })]);
        expect(planSetNeeded(w, "mon", 5)!.changes).toEqual([{ op: "update", shiftId: "mon", patch: { capacity: 5 } }]);
        expect(planSetNeeded(w, "mon", 1)!.changes).toEqual([{ op: "update", shiftId: "mon", patch: { capacity: 2 } }]);
        expect(planSetNeeded(w, "mon", 0)!.changes).toEqual([{ op: "update", shiftId: "mon", patch: { capacity: 2 } }]);
        expect(planSetNeeded(w, "mon", 3)).toBeNull();
    });

    test("copy to other days makes one new shift per day, with the same people, skipping days they already work it", () => {
        const w = week([
            shift({ id: "mon", capacity: 2, filled: 2, assignees: [assignee("ana"), assignee("ben")] }),
            shift({ id: "wed", dayIndex: 3, localDate: "2026-09-30", capacity: 1, assignees: [assignee("ana")] }),
        ]);
        const plan = planCopyToDays(w, "mon", [1, 2, 3, 4], { keepPeople: true });
        // Mon is the source and Wed already has Ana on the same shift; Tue and Thu get a copy.
        expect(plan!.changes.map((c) => c.op)).toEqual(["create", "create"]);
        expect(plan!.changes.map((c) => (c as { shift: { localDate: string } }).shift.localDate)).toEqual(["2026-09-29", "2026-10-01"]);
        expect(plan!.changes[0]).toMatchObject({
            shift: { role: "Server", startLocal: "16:00", endLocal: "23:00", capacity: 2 },
            assignees: [{ personId: "ana" }, { personId: "ben" }],
        });
        expect(plan!.label).toBe("Copied 4p–11p Server to Tue, Thu");
    });

    test("copying without people leaves every copy open, even where the same people already work it", () => {
        const w = week([
            shift({ id: "mon", capacity: 2, filled: 1, open: 1, assignees: [assignee("ana")] }),
            shift({ id: "wed", dayIndex: 3, localDate: "2026-09-30", assignees: [assignee("ana")] }),
        ]);
        const plan = planCopyToDays(w, "mon", [2, 3], { keepPeople: false });
        expect(plan!.changes).toHaveLength(2);
        expect(plan!.changes.every((c) => (c as { assignees: unknown[] }).assignees.length === 0)).toBe(true);
        expect(plan!.changes[0]).toMatchObject({ shift: { capacity: 2 } });
    });

    test("copying with nowhere to go does nothing", () => {
        const w = week([shift({ id: "mon", assignees: [assignee("ana")] })]);
        expect(planCopyToDays(w, "mon", [1], { keepPeople: true })).toBeNull();
        expect(planCopyToDays(w, "mon", [], { keepPeople: true })).toBeNull();
        expect(planCopyToDays(w, "nope", [2], { keepPeople: true })).toBeNull();
    });
});
