import type { SchedulerWeek } from "@repo/contracts/scheduler";

/** Every role the business uses: departments first, then anything on the roster or the schedule. */
export function knownRoles(week: SchedulerWeek): string[] {
    const roles = new Set<string>();
    for (const d of week.departments) d.roles.forEach((r) => roles.add(r));
    for (const p of week.people) p.roles.forEach((r) => roles.add(r));
    for (const s of week.shifts) roles.add(s.role);
    return [...roles];
}
