/**
 * The Schedule workspace's data: one week across one site or all of them, and
 * a day of it grouped into events and services. Pure functions, so the rules
 * for what each view says are tested without a browser.
 *
 * The API serves one site's week at a time. "All sites" is those weeks put
 * side by side: shifts and events from each site, people once (a person's
 * scheduled hours already count every site).
 */

import type { SchedulerAssignee, SchedulerEvent, SchedulerPerson, SchedulerShift, SchedulerWeek } from "@repo/contracts/scheduler";
import { compactTime } from "./format";

export const ALL_SITES = "all";

export interface Site {
    id: string;
    name: string;
}

/** The API's event doesn't say where it is; the week it came from does. */
export type WorkspaceEvent = SchedulerEvent & { locationId: string };

export interface Workspace {
    /** What the grids draw: the one site's week, or every site's put together. */
    week: SchedulerWeek;
    events: WorkspaceEvent[];
    /** The sites in scope: one, or all. */
    sites: Site[];
    /** Each site's own week, for anything that is per site (publishing, copy week). */
    weeks: SchedulerWeek[];
}

const uniqueById = <T extends { id: string }>(lists: T[][]): T[] => {
    const seen = new Map<string, T>();
    for (const list of lists) for (const item of list) if (!seen.has(item.id)) seen.set(item.id, item);
    return [...seen.values()];
};

/** Put the sites' weeks together. One week is returned as it is. */
export function mergeWeeks(weeks: SchedulerWeek[], sites: Site[]): Workspace {
    const events = weeks.flatMap((w) => w.events.map((e) => ({ ...e, locationId: w.location.id })));
    if (weeks.length === 1) return { week: weeks[0]!, events, sites, weeks };

    const base = weeks[0]!;
    const week: SchedulerWeek = {
        ...base,
        location: { id: ALL_SITES, name: "All sites", timezone: base.location.timezone },
        people: uniqueById(weeks.map((w) => w.people)),
        shifts: weeks.flatMap((w) => w.shifts),
        events: weeks.flatMap((w) => w.events),
        timeOff: uniqueById(weeks.map((w) => w.timeOff)),
        unavailable: uniqueById(weeks.map((w) => w.unavailable)),
        summary: {
            openSlots: weeks.reduce((sum, w) => sum + w.summary.openSlots, 0),
            pendingChangeCount: weeks.reduce((sum, w) => sum + w.summary.pendingChangeCount, 0),
            // Requests belong to the organization, not a site.
            pendingRequestCount: Math.max(...weeks.map((w) => w.summary.pendingRequestCount)),
        },
    };
    return { week, events, sites, weeks };
}

// ---------------------------------------------------------------------------
// A day: events and services
// ---------------------------------------------------------------------------

/** A position staff can pick up: the shift is published and nothing about it is waiting to be published. */
const isLive = (shift: SchedulerShift) => shift.status !== "draft" && !shift.hasUnpublishedEdits;

export interface RoleBlock {
    shift: SchedulerShift;
    /** Who is on it, in the order the API lists them. */
    people: { person: SchedulerPerson | undefined; assignee: SchedulerAssignee }[];
    unfilled: number;
    /** Staff can see this shift as it stands, so its empty positions are open for pickup now. */
    live: boolean;
}

export type Publication = "draft" | "published" | "mixed";

export interface DayItem {
    key: string;
    /** A named event, or the shifts at one site and time that have none. */
    kind: "event" | "service";
    name: string;
    eventId: string | null;
    siteId: string;
    siteName: string;
    startLocal: string;
    endLocal: string;
    overnight: boolean;
    blocks: RoleBlock[];
    needed: number;
    assigned: number;
    unfilled: number;
    /** Unfilled positions that are published, so eligible staff can pick them up now. */
    openNow: number;
    /** Unfilled positions still in a draft (or an unpublished edit): they open for pickup when published. */
    openLater: number;
    /** Staff can see all of it (published), none of it (draft), or some (mixed). */
    publication: Publication;
}

const byTime = (a: { startLocal: string; endLocal: string }, b: { startLocal: string; endLocal: string }) =>
    a.startLocal.localeCompare(b.startLocal) || a.endLocal.localeCompare(b.endLocal);

function publicationOf(blocks: RoleBlock[]): Publication {
    const draft = (b: RoleBlock) => b.shift.status === "draft";
    if (blocks.every(draft)) return "draft";
    const staged = (b: RoleBlock) => draft(b) || b.shift.hasUnpublishedEdits || b.people.some((p) => p.assignee.pendingState !== null);
    return blocks.some(staged) ? "mixed" : "published";
}

/** "Server", "Server · Bartender", "Server · +2 more". */
function serviceName(blocks: RoleBlock[]): string {
    const roles = [...new Set(blocks.map((b) => b.shift.role))];
    if (roles.length <= 2) return roles.join(" · ");
    return `${roles[0]} · +${roles.length - 1} more`;
}

/**
 * Everything happening on one local date, soonest first. Shifts that belong to
 * an event are that event's roles; the rest are grouped as a service by site
 * and time, so an ordinary café shift needs no named event.
 */
export function buildDayPlan(ws: Workspace, localDate: string, options: { needsPeopleOnly?: boolean } = {}): DayItem[] {
    const people = new Map(ws.week.people.map((p) => [p.id, p]));
    const siteName = new Map(ws.sites.map((s) => [s.id, s.name]));
    const events = new Map(ws.events.map((e) => [e.id, e]));
    const groups = new Map<string, { eventId: string | null; siteId: string; shifts: SchedulerShift[] }>();

    for (const shift of ws.week.shifts) {
        if (shift.localDate !== localDate || shift.pendingRemoval) continue;
        const key = shift.eventId ? `evt:${shift.eventId}` : `svc:${shift.locationId}:${shift.startLocal}-${shift.endLocal}`;
        const group = groups.get(key) ?? { eventId: shift.eventId, siteId: shift.locationId, shifts: [] };
        group.shifts.push(shift);
        groups.set(key, group);
    }

    const items: DayItem[] = [];
    for (const [key, group] of groups) {
        const blocks: RoleBlock[] = [...group.shifts].sort(byTime).map((shift) => ({
            shift,
            people: shift.assignees.map((assignee) => ({ person: people.get(assignee.personId), assignee })),
            unfilled: shift.open,
            live: isLive(shift),
        }));
        const event = group.eventId ? events.get(group.eventId) : undefined;
        const first = blocks[0]!.shift;
        const last = blocks.reduce((latest, b) => (b.shift.endLocal > latest.endLocal ? b.shift : latest), first);
        const item: DayItem = {
            key,
            kind: event ? "event" : "service",
            name: event?.name ?? serviceName(blocks),
            eventId: group.eventId,
            siteId: group.siteId,
            siteName: siteName.get(group.siteId) ?? "",
            startLocal: event?.startLocal ?? first.startLocal,
            endLocal: event?.endLocal ?? last.endLocal,
            overnight: event ? event.endLocal <= event.startLocal : last.overnight,
            blocks,
            needed: blocks.reduce((sum, b) => sum + b.shift.capacity, 0),
            assigned: blocks.reduce((sum, b) => sum + b.shift.filled, 0),
            unfilled: blocks.reduce((sum, b) => sum + b.unfilled, 0),
            openNow: blocks.reduce((sum, b) => sum + (isLive(b.shift) ? b.unfilled : 0), 0),
            openLater: blocks.reduce((sum, b) => sum + (isLive(b.shift) ? 0 : b.unfilled), 0),
            publication: publicationOf(blocks),
        };
        if (options.needsPeopleOnly && item.unfilled === 0) continue;
        items.push(item);
    }

    return items.sort((a, b) => byTime(a, b) || a.siteName.localeCompare(b.siteName) || a.name.localeCompare(b.name));
}

export { isLive as isOpenForPickup };

export interface UnfilledDay {
    /** Positions still without a person. */
    unfilled: number;
    /** Events and services those positions belong to. */
    events: number;
    /** Everything on the day, staffed or not. */
    items: number;
}

/** Per day: how many positions and events still need people, and how much is on at all. */
export function unfilledByDay(ws: Workspace): UnfilledDay[] {
    return ws.week.days.map((day) => {
        const all = buildDayPlan(ws, day.localDate);
        const needing = all.filter((item) => item.unfilled > 0);
        return { unfilled: needing.reduce((sum, item) => sum + item.unfilled, 0), events: needing.length, items: all.length };
    });
}

/** Shifts that still have empty positions, per day of the week, in time order: the Open shifts row. */
export function openShiftsByDay(ws: Workspace): SchedulerShift[][] {
    const days: SchedulerShift[][] = ws.week.days.map(() => []);
    for (const shift of ws.week.shifts) {
        if (shift.open > 0 && !shift.pendingRemoval && shift.dayIndex >= 0 && shift.dayIndex < 7) days[shift.dayIndex]!.push(shift);
    }
    return days.map((list) => list.sort(byTime));
}

/** "11a–4p", with the next-day mark when it ends after midnight: "9p–2a +1". */
export function rangeLabel(item: { startLocal: string; endLocal: string; overnight: boolean }): string {
    const range = `${compactTime(item.startLocal)}–${compactTime(item.endLocal)}`;
    return item.overnight ? `${range} +1` : range;
}

// ---------------------------------------------------------------------------
// Publishing scope
// ---------------------------------------------------------------------------

export interface SiteScope {
    site: Site;
    /** Drafts, staged edits and staged removals at that site this week. */
    pending: number;
}

/** Which sites have something to publish, split into what the filter includes and what it doesn't. */
export function publishScope(allWeeks: SchedulerWeek[], inScopeIds: string[]): { included: SiteScope[]; excluded: SiteScope[] } {
    const scopes = allWeeks.map((w) => ({ site: { id: w.location.id, name: w.location.name }, pending: w.summary.pendingChangeCount }));
    const inScope = new Set(inScopeIds);
    return {
        included: scopes.filter((s) => inScope.has(s.site.id) && s.pending > 0),
        excluded: scopes.filter((s) => !inScope.has(s.site.id) && s.pending > 0),
    };
}
