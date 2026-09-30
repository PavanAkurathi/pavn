/**
 * What the day-first screen draws: how covered each day is, and what one day
 * looks like grouped by part of the day. Pure functions over the API's week,
 * like view-model.ts, so the rules are tested without a browser.
 */

import type {
    ConflictWarning,
    SchedulerAssignee,
    SchedulerEvent,
    SchedulerPerson,
    SchedulerShift,
    SchedulerWeek,
} from "@repo/contracts/scheduler";
import { compactRange, firstNameOf } from "./format";
import { ALL_DEPARTMENTS, departmentOfRole, inDepartment, isBlocking } from "./view-model";

// ---- Parts of the day -----------------------------------------------------------

/** A shift belongs to the part of the day it starts in. Overnight shifts start in the evening. */
export const AFTERNOON_FROM = "11:00";
export const EVENING_FROM = "16:00";

export type PartOfDay = "morning" | "afternoon" | "evening";
export const PART_LABELS: Record<PartOfDay, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
const PART_ORDER: PartOfDay[] = ["morning", "afternoon", "evening"];

export function partOfDay(startLocal: string): PartOfDay {
    if (startLocal < AFTERNOON_FROM) return "morning";
    if (startLocal < EVENING_FROM) return "afternoon";
    return "evening";
}

// ---- Locked shifts --------------------------------------------------------------

/** The statuses the server lets a manager edit; the rest (started, done, approved) change from the timesheet. */
const EDITABLE = new Set(["draft", "published", "open", "assigned"]);
export const isLocked = (shift: Pick<SchedulerShift, "status">) => !EDITABLE.has(shift.status);

// ---- Filters --------------------------------------------------------------------

export interface DayFilter {
    department?: string;
    search?: string;
}

function makeFilters(week: SchedulerWeek, filter: DayFilter) {
    const department = filter.department ?? ALL_DEPARTMENTS;
    const deptOf = departmentOfRole(week);
    const query = (filter.search ?? "").trim().toLowerCase();
    return {
        query,
        shiftInView: (shift: SchedulerShift) => inDepartment(department, deptOf(shift.role)),
        personInView: (person: SchedulerPerson) =>
            inDepartment(department, person.departmentId) && (!query || person.name.toLowerCase().includes(query)),
    };
}

const byStart = (a: SchedulerShift, b: SchedulerShift) =>
    a.startLocal.localeCompare(b.startLocal) || a.endLocal.localeCompare(b.endLocal) || a.id.localeCompare(b.id);

// ---- Coverage: the week strip -----------------------------------------------------

export type DayStatus = "empty" | "covered" | "needs" | "problem";

export interface DayCoverage {
    dayIndex: number;
    /** Spots the day needs, and how many have someone. */
    needed: number;
    filled: number;
    open: number;
    /** People with a blocking conflict (double-booked, on approved time off). */
    problems: number;
    /** People with only soft warnings (near overtime, unavailable, not set up for the role). */
    headsUps: number;
    events: number;
    /** problem beats needs beats covered, so a real conflict is never hidden by an open spot. */
    status: DayStatus;
}

export function dayCoverage(week: SchedulerWeek, dayIndex: number, filter: DayFilter = {}): DayCoverage {
    const { shiftInView } = makeFilters(week, filter);
    let needed = 0;
    let filled = 0;
    let open = 0;
    let problems = 0;
    let headsUps = 0;
    for (const shift of week.shifts) {
        if (shift.dayIndex !== dayIndex || shift.pendingRemoval || !shiftInView(shift)) continue;
        needed += shift.capacity;
        filled += shift.filled;
        open += shift.open;
        for (const assignee of shift.assignees) {
            if (assignee.pendingState === "remove") continue;
            if (isBlocking(assignee)) problems++;
            else if (assignee.warnings.length > 0) headsUps++;
        }
    }
    const events = week.events.filter((e) => e.dayIndex === dayIndex).length;
    const status: DayStatus = problems > 0 ? "problem" : open > 0 ? "needs" : needed > 0 ? "covered" : "empty";
    return { dayIndex, needed, filled, open, problems, headsUps, events, status };
}

export function weekCoverage(week: SchedulerWeek, filter: DayFilter = {}): DayCoverage[] {
    return week.days.map((d) => dayCoverage(week, d.index, filter));
}

// ---- One day, grouped -------------------------------------------------------------

export interface NeededItem {
    kind: "needed";
    shift: SchedulerShift;
    open: number;
}

export interface PersonItem {
    kind: "person";
    shift: SchedulerShift;
    assignee: SchedulerAssignee;
    person: SchedulerPerson | null;
}

export interface PartGroup {
    part: PartOfDay;
    label: string;
    needed: NeededItem[];
    people: PersonItem[];
}

export interface AwayNote {
    personId: string;
    text: string;
    tone: "off" | "asked" | "unavailable";
}

export interface DayModel {
    /** Morning, afternoon, evening; only the ones with something in them. */
    groups: PartGroup[];
    /** People working, spots still open, and paid minutes across the day. */
    working: number;
    open: number;
    paidMinutes: number;
    events: SchedulerEvent[];
    away: AwayNote[];
}

export function buildDay(week: SchedulerWeek, dayIndex: number, filter: DayFilter = {}): DayModel {
    const { query, shiftInView, personInView } = makeFilters(week, filter);
    const people = new Map(week.people.map((p) => [p.id, p]));
    const groups = new Map<PartOfDay, PartGroup>(
        PART_ORDER.map((part) => [part, { part, label: PART_LABELS[part], needed: [], people: [] }]),
    );

    const working = new Set<string>();
    let open = 0;
    let paidMinutes = 0;

    for (const shift of [...week.shifts].sort(byStart)) {
        if (shift.dayIndex !== dayIndex || !shiftInView(shift)) continue;
        const group = groups.get(partOfDay(shift.startLocal))!;

        // Open spots: a search by name has nothing to say about them, but a role match keeps them.
        if (!shift.pendingRemoval && shift.open > 0 && (!query || shift.role.toLowerCase().includes(query))) {
            group.needed.push({ kind: "needed", shift, open: shift.open });
            open += shift.open;
        }

        for (const assignee of shift.assignees) {
            const person = people.get(assignee.personId) ?? null;
            if (person && !personInView(person)) continue;
            if (!person && query) continue;
            group.people.push({ kind: "person", shift, assignee, person });
            if (!shift.pendingRemoval && assignee.pendingState !== "remove") {
                working.add(assignee.personId);
                paidMinutes += shift.paidMinutes;
            }
        }
    }

    for (const group of groups.values()) {
        group.people.sort(
            (a, b) =>
                byStart(a.shift, b.shift) || (a.person?.name ?? "").localeCompare(b.person?.name ?? ""),
        );
    }

    return {
        groups: PART_ORDER.map((part) => groups.get(part)!).filter((g) => g.needed.length + g.people.length > 0),
        working: working.size,
        open,
        paidMinutes,
        events: week.events.filter((e) => e.dayIndex === dayIndex),
        away: awayOnDay(week, dayIndex, filter),
    };
}

// ---- Who is away ------------------------------------------------------------------

export function awayOnDay(week: SchedulerWeek, dayIndex: number, filter: DayFilter = {}): AwayNote[] {
    const { personInView } = makeFilters(week, filter);
    const people = new Map(week.people.map((p) => [p.id, p]));
    const notes = new Map<string, AwayNote>();
    const add = (personId: string, tone: AwayNote["tone"], text: string) => {
        const person = people.get(personId);
        if (!person || !personInView(person)) return;
        // One line per person and kind of absence.
        const key = `${personId}:${tone}`;
        if (!notes.has(key)) notes.set(key, { personId, tone, text });
    };
    const when = (span: { wholeDay: boolean; startLocal: string; endLocal: string }) =>
        span.wholeDay ? "all day" : compactRange(span.startLocal, span.endLocal);

    for (const t of week.timeOff) {
        const first = firstNameOf(people.get(t.personId)?.name);
        for (const span of t.spans) {
            if (span.dayIndex !== dayIndex) continue;
            if (t.status === "approved") add(t.personId, "off", `${first} off ${when(span)}`);
            else add(t.personId, "asked", `${first} asked for time off`);
        }
    }
    for (const u of week.unavailable) {
        const first = firstNameOf(people.get(u.personId)?.name);
        for (const span of u.spans) {
            if (span.dayIndex === dayIndex) add(u.personId, "unavailable", `${first} unavailable ${when(span)}`);
        }
    }
    return [...notes.values()];
}

// ---- Things to check ---------------------------------------------------------------

export interface WeekIssue {
    key: string;
    dayIndex: number;
    shiftId: string;
    personId: string;
    personName: string;
    warning: ConflictWarning;
}

export interface WeekIssues {
    /** Every warning on someone's shift, worst first. */
    issues: WeekIssue[];
    /** Blocking ones only: the "to check" count. */
    blocking: number;
    firstDayWithOpen: number | null;
    firstDayWithProblem: number | null;
}

export function weekIssues(week: SchedulerWeek, filter: DayFilter = {}): WeekIssues {
    const { shiftInView } = makeFilters(week, filter);
    const people = new Map(week.people.map((p) => [p.id, p]));
    const issues: WeekIssue[] = [];
    const seen = new Set<string>();

    for (const shift of [...week.shifts].sort((a, b) => a.dayIndex - b.dayIndex || byStart(a, b))) {
        if (shift.pendingRemoval || !shiftInView(shift)) continue;
        for (const assignee of shift.assignees) {
            if (assignee.pendingState === "remove") continue;
            for (const warning of assignee.warnings) {
                const key = `${shift.id}:${assignee.personId}:${warning.type}`;
                if (seen.has(key)) continue;
                seen.add(key);
                issues.push({
                    key,
                    dayIndex: shift.dayIndex,
                    shiftId: shift.id,
                    personId: assignee.personId,
                    personName: people.get(assignee.personId)?.name ?? "Someone",
                    warning,
                });
            }
        }
    }
    issues.sort((a, b) => Number(b.warning.severity === "block") - Number(a.warning.severity === "block") || a.dayIndex - b.dayIndex);

    const coverage = weekCoverage(week, filter);
    return {
        issues,
        blocking: issues.filter((i) => i.warning.severity === "block").length,
        firstDayWithOpen: coverage.find((c) => c.open > 0)?.dayIndex ?? null,
        firstDayWithProblem: coverage.find((c) => c.problems > 0)?.dayIndex ?? null,
    };
}

// ---- Words for the strip ------------------------------------------------------------

/** The short line under a day in the week strip, and the words a screen reader hears. */
export function coverageText(c: DayCoverage): { short: string; long: string } {
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    const parts: string[] = [];
    if (c.problems > 0) parts.push(`${c.problems} to check`);
    if (c.open > 0) parts.push(`${plural(c.open, "spot", "spots")} open`);
    if (c.status === "covered") parts.push("all set");
    if (c.status === "empty") parts.push("nothing planned");
    const short =
        c.status === "problem"
            ? `${c.problems} to check`
            : c.status === "needs"
                ? `${c.open} open`
                : c.status === "covered"
                    ? "All set"
                    : "Nothing yet";
    return { short, long: parts.join(", ") };
}

// ---- Times people already use ---------------------------------------------------------

/** The shift times used most this week, so adding one is a tap instead of typing. */
export function commonRanges(week: SchedulerWeek, limit = 4): { startLocal: string; endLocal: string }[] {
    const counts = new Map<string, { startLocal: string; endLocal: string; n: number }>();
    for (const shift of week.shifts) {
        if (shift.pendingRemoval) continue;
        const key = `${shift.startLocal}-${shift.endLocal}`;
        const entry = counts.get(key) ?? { startLocal: shift.startLocal, endLocal: shift.endLocal, n: 0 };
        entry.n++;
        counts.set(key, entry);
    }
    return [...counts.values()]
        .sort((a, b) => b.n - a.n || a.startLocal.localeCompare(b.startLocal))
        .slice(0, limit)
        .map(({ startLocal, endLocal }) => ({ startLocal, endLocal }));
}

// ---- What publishing would actually do ---------------------------------------------------

/**
 * Changes a publish would send: new drafts that haven't ended yet, and edits or
 * removals to shared shifts. The server's own count also includes drafts whose
 * time has passed; publishing skips those, so counting them here would leave a
 * "publish" prompt on screen that nothing can clear.
 */
export function publishableChanges(week: SchedulerWeek, now: number = Date.now()): number {
    let count = 0;
    for (const shift of week.shifts) {
        if (shift.status === "draft") {
            if (Date.parse(shift.endsAt) > now) count++;
        } else if (shift.hasUnpublishedEdits || shift.pendingRemoval || shift.assignees.some((a) => a.pendingState !== null)) {
            count++;
        }
    }
    return count;
}
