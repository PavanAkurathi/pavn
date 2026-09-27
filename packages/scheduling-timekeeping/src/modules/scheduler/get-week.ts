// packages/scheduling-timekeeping/src/modules/scheduler/get-week.ts

import { db } from "@repo/database";
import {
    department,
    location,
    member,
    organization,
    rosterEntry,
    scheduleEvent,
    shift,
    shiftRequest,
    tempWorker,
    timeOffRequest,
    user,
    workerAvailability,
    workerRole,
    type ShiftPendingPatch,
} from "@repo/database/schema";
import { AppError } from "@repo/observability";
import type {
    ConflictWarning,
    SchedulerDepartment,
    SchedulerEvent,
    SchedulerPerson,
    SchedulerShift,
    SchedulerTimeOff,
    SchedulerUnavailable,
    SchedulerWeek,
} from "@repo/contracts/scheduler";
import { and, eq, gt, inArray, lt, ne, notInArray } from "drizzle-orm";

import { evaluateConflicts } from "../../domain/conflicts";
import { addedOvertimeMinutes, paidMinutes, summarizeWeek, type OvertimePolicy, type WorkInterval } from "../../domain/hours";
import { compactRange, compactTime, dayName } from "../../domain/labels";
import { dayIndexOf, isLocalDate, splitIntoDaySpans, startOfLocalWeek, weekBounds, weekDates } from "../../domain/week";
import { canonicalizeCrewRole, deriveCrewRoles } from "../../utils/crew-roles";
import { getInitials } from "../../utils/formatting";
import { localDateInZone, localTimeInZone } from "../../utils/zoned-time";

type PersonKind = "roster" | "invited" | "agency";
type AssignmentRow = {
    id: string;
    workerId: string | null;
    tempWorkerId: string | null;
    rosterEntryId: string | null;
    status: string;
    pendingState: string | null;
};

const MANAGER_ROLES = ["admin", "manager", "owner"];
const DEAD_ASSIGNMENT = new Set(["removed", "cancelled"]);
// Wide enough that an overnight shift from the day before still shows up as an overlap.
const OVERLAP_PADDING_MS = 24 * 60 * 60 * 1000;

export interface GetSchedulerWeekInput {
    orgId: string;
    locationId: string;
    /** Any date inside the wanted week; defaults to the location's current week. */
    weekStart?: string;
    /** Injectable clock for tests. */
    now?: Date;
}

/**
 * Everything the manager's weekly Scheduler draws, in one read.
 *
 * The grid shows one location, but hours and double-bookings are counted
 * across the whole organization: a person who works 30 hours downtown and 12
 * at the market is in overtime at both. Published shifts with staged edits are
 * shown as the manager's working copy; staff keep seeing the published version
 * until the week is published.
 */
export async function getSchedulerWeek(input: GetSchedulerWeekInput): Promise<SchedulerWeek> {
    const now = input.now ?? new Date();

    if (input.weekStart !== undefined && !isLocalDate(input.weekStart)) {
        throw new AppError("weekStart must be a date like 2026-09-27", "INVALID_WEEK_START", 400);
    }

    const [org, locations] = await Promise.all([
        db.query.organization.findFirst({
            where: eq(organization.id, input.orgId),
            columns: {
                timezone: true,
                regionalOvertimePolicy: true,
                weekStartsOn: true,
                scheduleStyle: true,
                openShiftClaimPolicy: true,
            },
        }),
        db.query.location.findMany({
            where: eq(location.organizationId, input.orgId),
            columns: { id: true, name: true, timezone: true },
        }),
    ]);

    if (!org) throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
    const loc = locations.find((l) => l.id === input.locationId);
    if (!loc) throw new AppError("Location not found", "LOCATION_NOT_FOUND", 404);

    const tz = loc.timezone || org.timezone;
    const policy: OvertimePolicy = org.regionalOvertimePolicy === "daily_8" ? "daily_8" : "weekly_40";
    const weekStartsOn = org.weekStartsOn ?? 0;
    const weekStart = startOfLocalWeek(input.weekStart ?? localDateInZone(now, tz), weekStartsOn);
    const dates = weekDates(weekStart);
    const bounds = weekBounds(weekStart, tz);
    const padStart = new Date(bounds.start.getTime() - OVERLAP_PADDING_MS);
    const padEnd = new Date(bounds.end.getTime() + OVERLAP_PADDING_MS);
    const locationById = new Map(locations.map((l) => [l.id, l]));

    const [shiftRows, members, roleRows, rosterRows, timeOffRows, availabilityRows, eventRows, departmentRows, openShiftRequests, openTimeOff] =
        await Promise.all([
            db.query.shift.findMany({
                where: and(
                    eq(shift.organizationId, input.orgId),
                    lt(shift.startTime, padEnd),
                    gt(shift.endTime, padStart),
                    ne(shift.status, "cancelled"),
                ),
                with: {
                    assignments: {
                        columns: { id: true, workerId: true, tempWorkerId: true, rosterEntryId: true, status: true, pendingState: true },
                    },
                },
            }),
            db.query.member.findMany({
                where: and(eq(member.organizationId, input.orgId), notInArray(member.role, MANAGER_ROLES)),
                columns: { jobTitle: true },
                with: { user: { columns: { id: true, name: true, email: true } } },
            }),
            db.query.workerRole.findMany({
                where: eq(workerRole.organizationId, input.orgId),
                columns: { workerId: true, role: true },
            }),
            db.query.rosterEntry.findMany({
                where: eq(rosterEntry.organizationId, input.orgId),
                columns: { id: true, name: true, email: true, roles: true, jobTitle: true },
            }),
            db.query.timeOffRequest.findMany({
                where: and(
                    eq(timeOffRequest.organizationId, input.orgId),
                    inArray(timeOffRequest.status, ["approved", "pending"]),
                    lt(timeOffRequest.startTime, padEnd),
                    gt(timeOffRequest.endTime, padStart),
                ),
            }),
            db.query.workerAvailability.findMany({
                where: and(
                    eq(workerAvailability.organizationId, input.orgId),
                    eq(workerAvailability.type, "unavailable"),
                    lt(workerAvailability.startTime, padEnd),
                    gt(workerAvailability.endTime, padStart),
                ),
            }),
            db.query.scheduleEvent.findMany({
                where: and(
                    eq(scheduleEvent.organizationId, input.orgId),
                    eq(scheduleEvent.locationId, loc.id),
                    lt(scheduleEvent.startTime, bounds.end),
                    gt(scheduleEvent.endTime, bounds.start),
                ),
            }),
            db.query.department.findMany({
                where: eq(department.organizationId, input.orgId),
            }),
            db.query.shiftRequest.findMany({
                where: and(
                    eq(shiftRequest.organizationId, input.orgId),
                    inArray(shiftRequest.status, ["pending_peer", "pending_manager"]),
                ),
                columns: { id: true },
            }),
            db.query.timeOffRequest.findMany({
                where: and(eq(timeOffRequest.organizationId, input.orgId), eq(timeOffRequest.status, "pending")),
                columns: { id: true },
            }),
        ]);

    // ---- The manager's working copy of each shift ---------------------------
    type WorkingShift = {
        row: (typeof shiftRows)[number];
        patch: ShiftPendingPatch | null;
        start: Date;
        end: Date;
        role: string;
        breakMinutes: number;
        capacity: number;
        tz: string;
        live: AssignmentRow[];
    };

    const working: WorkingShift[] = shiftRows.map((row) => {
        const patch = (row.pendingPatch ?? null) as ShiftPendingPatch | null;
        const shiftTz = row.timezone || (row.locationId ? locationById.get(row.locationId)?.timezone : null) || tz;
        return {
            row,
            patch,
            start: patch?.startTime ? new Date(patch.startTime) : row.startTime,
            end: patch?.endTime ? new Date(patch.endTime) : row.endTime,
            role: patch?.title ?? row.title,
            breakMinutes: patch?.breakMinutes ?? row.breakMinutes ?? 0,
            capacity: patch?.capacityTotal ?? row.capacityTotal,
            tz: shiftTz,
            live: (row.assignments as AssignmentRow[]).filter((a) => !DEAD_ASSIGNMENT.has(a.status)),
        };
    });

    // A person counts toward a shift unless they are staged to come off it,
    // and a shift staged for removal counts for nobody.
    const counts = (ws: WorkingShift) => !ws.patch?.cancel;
    const stays = (a: AssignmentRow) => a.pendingState !== "remove";

    // ---- People ---------------------------------------------------------------
    const people = new Map<string, SchedulerPerson>();
    const rolesByWorker = new Map<string, string[]>();
    for (const r of roleRows) {
        const list = rolesByWorker.get(r.workerId) ?? [];
        list.push(r.role);
        rolesByWorker.set(r.workerId, list);
    }

    const addPerson = (id: string, kind: PersonKind, name: string, roles: string[], agencyName: string | null = null) => {
        if (people.has(id)) return;
        people.set(id, {
            id,
            kind,
            name,
            initials: getInitials(name),
            roles,
            primaryRole: roles[0] ?? null,
            departmentId: null,
            agencyName,
            scheduledMinutes: 0,
            overtimeMinutes: 0,
        });
    };

    const memberEmails = new Set<string>();
    for (const m of members) {
        if (!m.user) continue;
        memberEmails.add((m.user.email || "").toLowerCase());
        addPerson(m.user.id, "roster", m.user.name, deriveCrewRoles(rolesByWorker.get(m.user.id) ?? [], m.jobTitle));
    }
    for (const entry of rosterRows) {
        if (memberEmails.has((entry.email || "").toLowerCase())) continue;
        const roles = deriveCrewRoles(entry.roles ?? [], entry.jobTitle);
        addPerson(entry.id, "invited", entry.name, roles);
    }

    // Anyone on a shift this week who is not on the roster any more (a manager
    // who covered, someone who left, an agency worker) still needs a row.
    const personOf = (a: AssignmentRow): { id: string; kind: PersonKind } | null =>
        a.workerId ? { id: a.workerId, kind: "roster" }
            : a.rosterEntryId ? { id: a.rosterEntryId, kind: "invited" }
                : a.tempWorkerId ? { id: a.tempWorkerId, kind: "agency" }
                    : null;

    const inWeek = (ws: WorkingShift) => ws.start.getTime() >= bounds.start.getTime() && ws.start.getTime() < bounds.end.getTime();
    const missingUsers = new Set<string>();
    const missingTemps = new Set<string>();
    for (const ws of working) {
        if (ws.row.locationId !== loc.id || !inWeek(ws)) continue;
        for (const a of ws.live) {
            const who = personOf(a);
            if (!who || people.has(who.id)) continue;
            if (who.kind === "agency") missingTemps.add(who.id);
            else if (who.kind === "roster") missingUsers.add(who.id);
        }
    }
    const [extraUsers, temps] = await Promise.all([
        missingUsers.size
            ? db.query.user.findMany({ where: inArray(user.id, [...missingUsers]), columns: { id: true, name: true } })
            : Promise.resolve([]),
        missingTemps.size
            ? db.query.tempWorker.findMany({
                where: and(eq(tempWorker.organizationId, input.orgId), inArray(tempWorker.id, [...missingTemps])),
                columns: { id: true, name: true, agency: true },
            })
            : Promise.resolve([]),
    ]);
    for (const u of extraUsers) addPerson(u.id, "roster", u.name, deriveCrewRoles(rolesByWorker.get(u.id) ?? []));
    for (const t of temps) addPerson(t.id, "agency", t.name, [], t.agency ?? null);

    // ---- Departments ------------------------------------------------------------
    const departments: SchedulerDepartment[] = departmentRows.length
        ? [...departmentRows]
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            .map((d) => ({ id: d.id, name: d.name, roles: d.roles.map((r) => canonicalizeCrewRole(r) ?? r) }))
        : [{
            id: "team",
            name: "Team",
            roles: [...new Set([...people.values()].flatMap((p) => p.roles))].sort(),
        }];
    const departmentOfRole = new Map<string, string>();
    for (const d of departments) {
        for (const role of d.roles) {
            if (!departmentOfRole.has(role.toLowerCase())) departmentOfRole.set(role.toLowerCase(), d.id);
        }
    }
    // Main role first, then any role they hold, then a department with no roles
    // (it takes whoever nobody else claims).
    const catchAll = departments.find((d) => d.roles.length === 0)?.id ?? null;
    for (const p of people.values()) {
        const byRole = [p.primaryRole, ...p.roles]
            .map((role) => (role ? departmentOfRole.get(role.toLowerCase()) : undefined))
            .find(Boolean);
        p.departmentId = byRole ?? catchAll;
    }

    // ---- Hours, across every location ----------------------------------------
    const localDate = (ws: WorkingShift) => localDateInZone(ws.start, ws.tz);
    const intervalOf = (ws: WorkingShift): WorkInterval => ({
        start: ws.start,
        end: ws.end,
        breakMinutes: ws.breakMinutes,
        localDate: localDate(ws),
    });

    const shiftsByPerson = new Map<string, WorkingShift[]>();
    for (const ws of working) {
        if (!counts(ws)) continue;
        for (const a of ws.live) {
            if (!stays(a)) continue;
            const who = personOf(a);
            if (!who) continue;
            const list = shiftsByPerson.get(who.id) ?? [];
            list.push(ws);
            shiftsByPerson.set(who.id, list);
        }
    }
    for (const [personId, list] of shiftsByPerson) {
        const person = people.get(personId);
        if (!person) continue;
        const week = summarizeWeek(list.filter(inWeek).map(intervalOf), policy);
        person.scheduledMinutes = week.scheduledMinutes;
        person.overtimeMinutes = week.overtimeMinutes;
    }

    // ---- Time off and availability ---------------------------------------------
    const spanLabel = (start: Date, end: Date, allDay: boolean) => {
        const startDate = localDateInZone(start, tz);
        const lastDate = localDateInZone(new Date(end.getTime() - 1), tz);
        if (allDay) {
            return startDate === lastDate ? `${dayName(startDate)}, all day` : `${dayName(startDate)}–${dayName(lastDate)}`;
        }
        const from = localTimeInZone(start, tz);
        const to = localTimeInZone(end, tz);
        return startDate === lastDate
            ? `${dayName(startDate)} ${compactRange(from, to)}`
            : `${dayName(startDate)} ${compactTime(from)}–${dayName(lastDate)} ${compactTime(to)}`;
    };

    const timeOff: SchedulerTimeOff[] = [];
    const timeOffByPerson = new Map<string, ConflictContextTimeOff[]>();
    for (const t of timeOffRows) {
        const status = t.status === "approved" ? "approved" : "pending";
        const list = timeOffByPerson.get(t.workerId) ?? [];
        list.push({ start: t.startTime, end: t.endTime, status, label: spanLabel(t.startTime, t.endTime, t.allDay) });
        timeOffByPerson.set(t.workerId, list);
        const spans = splitIntoDaySpans(t.startTime, t.endTime, weekStart, tz);
        if (spans.length === 0) continue;
        timeOff.push({
            id: t.id,
            personId: t.workerId,
            status,
            allDay: t.allDay,
            reason: t.reason ?? null,
            startsAt: t.startTime.toISOString(),
            endsAt: t.endTime.toISOString(),
            spans,
        });
    }

    const unavailable: SchedulerUnavailable[] = [];
    const unavailableByPerson = new Map<string, Array<{ start: Date; end: Date; label: string }>>();
    for (const a of availabilityRows) {
        const list = unavailableByPerson.get(a.workerId) ?? [];
        list.push({ start: a.startTime, end: a.endTime, label: spanLabel(a.startTime, a.endTime, false) });
        unavailableByPerson.set(a.workerId, list);
        const spans = splitIntoDaySpans(a.startTime, a.endTime, weekStart, tz);
        if (spans.length === 0) continue;
        unavailable.push({
            id: a.id,
            personId: a.workerId,
            startsAt: a.startTime.toISOString(),
            endsAt: a.endTime.toISOString(),
            spans,
        });
    }

    // ---- This location's shifts --------------------------------------------------
    const shiftLabel = (ws: WorkingShift) => {
        const place = ws.row.locationId && ws.row.locationId !== loc.id
            ? ` at ${locationById.get(ws.row.locationId)?.name ?? "another location"}`
            : "";
        return `${dayName(localDate(ws))} ${compactRange(localTimeInZone(ws.start, ws.tz), localTimeInZone(ws.end, ws.tz))} ${ws.role}${place}`;
    };

    const warningsFor = (personId: string, ws: WorkingShift): ConflictWarning[] => {
        const person = people.get(personId);
        const mine = (shiftsByPerson.get(personId) ?? []).filter((other) => other !== ws);
        // Overtime is charged to the shift that crosses the line and those after it.
        const earlier = mine.filter((other) => inWeek(other) && other.start.getTime() < ws.start.getTime()).map(intervalOf);
        return evaluateConflicts(
            { shiftId: ws.row.id, start: ws.start, end: ws.end, role: ws.role },
            {
                personRoles: person?.roles ?? [],
                otherShifts: mine.map((other) => ({ shiftId: other.row.id, start: other.start, end: other.end, label: shiftLabel(other) })),
                timeOff: timeOffByPerson.get(personId) ?? [],
                unavailable: unavailableByPerson.get(personId) ?? [],
                addedOvertimeMinutes: inWeek(ws) ? addedOvertimeMinutes(earlier, intervalOf(ws), policy) : 0,
            },
        );
    };

    const shifts: SchedulerShift[] = [];
    let openSlots = 0;
    let pendingChangeCount = 0;
    for (const ws of working) {
        if (ws.row.locationId !== loc.id || !inWeek(ws)) continue;

        const assignees: SchedulerShift["assignees"] = ws.live.flatMap((a) => {
            const who = personOf(a);
            if (!who) return [];
            const pendingState: "add" | "remove" | null =
                a.pendingState === "add" || a.pendingState === "remove" ? a.pendingState : null;
            return [{
                personId: who.id,
                kind: who.kind,
                pendingState,
                warnings: counts(ws) && pendingState !== "remove" ? warningsFor(who.id, ws) : [],
            }];
        });
        const filled = assignees.filter((a) => a.pendingState !== "remove").length;
        const open = counts(ws) ? Math.max(ws.capacity - filled, 0) : 0;
        const staged = ws.patch !== null || ws.live.some((a) => a.pendingState !== null);
        const localDay = localDate(ws);
        const startLocal = localTimeInZone(ws.start, ws.tz);
        const endLocal = localTimeInZone(ws.end, ws.tz);

        openSlots += open;
        if (ws.row.status === "draft" || staged) pendingChangeCount++;

        shifts.push({
            id: ws.row.id,
            locationId: loc.id,
            dayIndex: dayIndexOf(ws.start, weekStart, tz),
            localDate: localDay,
            startLocal,
            endLocal,
            overnight: localDateInZone(new Date(ws.end.getTime() - 1), ws.tz) !== localDay,
            startsAt: ws.start.toISOString(),
            endsAt: ws.end.toISOString(),
            role: ws.role,
            breakMinutes: ws.breakMinutes,
            paidMinutes: paidMinutes(ws),
            capacity: ws.capacity,
            filled,
            open,
            status: ws.row.status as SchedulerShift["status"],
            hasUnpublishedEdits: ws.row.status !== "draft" && staged,
            pendingRemoval: !!ws.patch?.cancel,
            eventId: ws.patch?.eventId !== undefined ? ws.patch.eventId : ws.row.eventId ?? null,
            note: ws.patch?.description !== undefined ? ws.patch.description : ws.row.description ?? null,
            managerNote: ws.row.managerNote ?? null,
            assignees,
        });
    }
    shifts.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.role.localeCompare(b.role));

    // ---- Events ------------------------------------------------------------------
    const events: SchedulerEvent[] = eventRows.map((ev) => {
        const eventShifts = shifts.filter((s) => s.eventId === ev.id && !s.pendingRemoval);
        const startDate = localDateInZone(ev.startTime, tz);
        return {
            id: ev.id,
            name: ev.name,
            dayIndex: dayIndexOf(ev.startTime, weekStart, tz),
            localDate: startDate,
            startLocal: localTimeInZone(ev.startTime, tz),
            endLocal: localTimeInZone(ev.endTime, tz),
            startsAt: ev.startTime.toISOString(),
            endsAt: ev.endTime.toISOString(),
            notes: ev.notes ?? null,
            needed: eventShifts.reduce((n, s) => n + s.capacity, 0),
            filled: eventShifts.reduce((n, s) => n + Math.min(s.filled, s.capacity), 0),
        };
    }).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    const today = localDateInZone(now, tz);
    return {
        location: { id: loc.id, name: loc.name, timezone: tz },
        weekStart,
        weekStartsOn,
        days: dates.map((localDateValue, index) => ({ index, localDate: localDateValue, isToday: localDateValue === today })),
        settings: {
            overtimePolicy: policy,
            scheduleStyle: org.scheduleStyle === "events" ? "events" : "steady",
            openShiftClaimPolicy: org.openShiftClaimPolicy === "auto" ? "auto" : "approval",
        },
        departments,
        people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)),
        shifts,
        events,
        timeOff,
        unavailable,
        summary: {
            openSlots,
            pendingChangeCount,
            pendingRequestCount: openShiftRequests.length + openTimeOff.length,
        },
    };
}

type ConflictContextTimeOff = { start: Date; end: Date; status: "approved" | "pending"; label: string };
