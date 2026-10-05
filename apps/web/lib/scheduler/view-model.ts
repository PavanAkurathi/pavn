/**
 * Turns the API's week into what the grid draws. Pure functions, so the rules
 * for who sits where are tested without a browser.
 */

import type {
    SchedulerAssignee,
    SchedulerDaySpan,
    SchedulerPerson,
    SchedulerShift,
    SchedulerWeek,
} from "@repo/contracts/scheduler";

export const ALL_DEPARTMENTS = "all";
/** Section for people whose roles match no department and there is no catch-all. */
export const NO_DEPARTMENT = "none";

export interface AssignedShift {
    shift: SchedulerShift;
    assignee: SchedulerAssignee;
}

export interface TimeOffMark {
    id: string;
    status: "approved" | "pending";
    span: SchedulerDaySpan;
    reason: string | null;
}

export interface PersonDay {
    shifts: AssignedShift[];
    timeOff: TimeOffMark[];
    unavailable: SchedulerDaySpan[];
}

export interface PersonRow {
    person: SchedulerPerson;
    days: PersonDay[];
}

export interface Section {
    id: string;
    name: string;
    people: PersonRow[];
    openSlots: number;
    scheduledMinutes: number;
}

export interface PeopleView {
    /** Shifts with open slots, per day, in the departments in view. */
    open: SchedulerShift[][];
    sections: Section[];
    /** People in view after the department filter and search. */
    visibleCount: number;
}

const byStart = (a: SchedulerShift, b: SchedulerShift) =>
    a.startLocal.localeCompare(b.startLocal) || a.endLocal.localeCompare(b.endLocal) || a.id.localeCompare(b.id);

const emptyDays = <T,>(): T[][] => Array.from({ length: 7 }, () => []);

/** Same rule as the API: the first department listing the role, else the one with no roles. */
export function departmentOfRole(week: Pick<SchedulerWeek, "departments">): (role: string) => string | null {
    const map = new Map<string, string>();
    for (const d of week.departments) {
        for (const role of d.roles) if (!map.has(role.toLowerCase())) map.set(role.toLowerCase(), d.id);
    }
    const catchAll = week.departments.find((d) => d.roles.length === 0)?.id ?? null;
    return (role) => map.get(role.toLowerCase()) ?? catchAll;
}

function inDepartment(departmentFilter: string, departmentId: string | null) {
    if (departmentFilter === ALL_DEPARTMENTS) return true;
    if (departmentFilter === NO_DEPARTMENT) return departmentId === null;
    return departmentId === departmentFilter;
}

export function buildPeopleView(
    week: SchedulerWeek,
    options: { department: string; search: string },
): PeopleView {
    const deptOf = departmentOfRole(week);
    const query = options.search.trim().toLowerCase();

    const days = new Map<string, PersonDay[]>();
    const dayOf = (personId: string) => {
        let list = days.get(personId);
        if (!list) {
            list = Array.from({ length: 7 }, () => ({ shifts: [], timeOff: [], unavailable: [] }));
            days.set(personId, list);
        }
        return list;
    };

    const open = emptyDays<SchedulerShift>();
    const openByDept = new Map<string | null, number>();

    for (const shift of [...week.shifts].sort(byStart)) {
        for (const assignee of shift.assignees) {
            if (shift.dayIndex >= 0 && shift.dayIndex < 7) dayOf(assignee.personId)[shift.dayIndex]!.shifts.push({ shift, assignee });
        }
        if (shift.open > 0 && !shift.pendingRemoval) {
            const dept = deptOf(shift.role);
            openByDept.set(dept, (openByDept.get(dept) ?? 0) + shift.open);
            if (inDepartment(options.department, dept) && shift.dayIndex >= 0 && shift.dayIndex < 7) open[shift.dayIndex]!.push(shift);
        }
    }

    for (const t of week.timeOff) {
        for (const span of t.spans) {
            dayOf(t.personId)[span.dayIndex]!.timeOff.push({ id: t.id, status: t.status, span, reason: t.reason });
        }
    }
    for (const u of week.unavailable) {
        for (const span of u.spans) dayOf(u.personId)[span.dayIndex]!.unavailable.push(span);
    }

    const sectionOrder = [
        ...week.departments.map((d) => ({ id: d.id, name: d.name })),
        { id: NO_DEPARTMENT, name: "Other" },
    ];
    const sections = new Map<string, Section>(
        sectionOrder.map((s) => [
            s.id,
            {
                ...s,
                people: [],
                openSlots: openByDept.get(s.id === NO_DEPARTMENT ? null : s.id) ?? 0,
                scheduledMinutes: 0,
            },
        ]),
    );

    // Within a department, people follow the department's own role order
    // (Server before Busser in Front of house), then name.
    const roleRank = new Map<string, number>();
    for (const d of week.departments) d.roles.forEach((role, i) => roleRank.set(`${d.id}:${role.toLowerCase()}`, i));
    const rankOf = (p: SchedulerPerson) =>
        p.primaryRole ? roleRank.get(`${p.departmentId}:${p.primaryRole.toLowerCase()}`) ?? 99 : 100;
    const people = [...week.people].sort(
        (a, b) =>
            rankOf(a) - rankOf(b) ||
            (a.primaryRole ?? "").localeCompare(b.primaryRole ?? "") ||
            a.name.localeCompare(b.name),
    );
    let visibleCount = 0;
    for (const person of people) {
        const sectionId = person.departmentId ?? NO_DEPARTMENT;
        if (!inDepartment(options.department, person.departmentId)) continue;
        if (query && !person.name.toLowerCase().includes(query)) continue;
        const section = sections.get(sectionId) ?? sections.get(NO_DEPARTMENT)!;
        section.people.push({ person, days: days.get(person.id) ?? dayOf(person.id) });
        section.scheduledMinutes += person.scheduledMinutes;
        visibleCount++;
    }

    return {
        open,
        sections: [...sections.values()].filter((s) => s.people.length > 0),
        visibleCount,
    };
}

/** Weekly overtime starts at 40h; "near" is the last four hours before it. */
export const WEEKLY_LIMIT_MINUTES = 40 * 60;
export const NEAR_LIMIT_MINUTES = 36 * 60;

export type HoursTone = "normal" | "near" | "over";

export function hoursTone(person: Pick<SchedulerPerson, "scheduledMinutes" | "overtimeMinutes">, policy: "weekly_40" | "daily_8"): HoursTone {
    if (person.overtimeMinutes > 0) return "over";
    if (policy === "weekly_40" && person.scheduledMinutes >= NEAR_LIMIT_MINUTES) return "near";
    return "normal";
}

export function isBlocking(assignee: SchedulerAssignee): boolean {
    return assignee.warnings.some((w) => w.severity === "block");
}

/** People that aren't shown because of the filter/search, for the empty state. */
export function hiddenCount(week: SchedulerWeek, view: PeopleView): number {
    return week.people.length - view.visibleCount;
}
