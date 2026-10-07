// packages/scheduling-timekeeping/src/modules/requests/shared.ts

/**
 * What the worker and manager sides of requests share: loading a shift the
 * way staff see it, who may work what, the messages people get, and the two
 * live changes an approved request makes (put someone on a shift, take
 * someone off).
 *
 * Requests act on the published shift, not the manager's working copy: a
 * worker asks about what they can see. Counting is conservative on purpose:
 * people the manager has staged onto a shift count as taking a spot, so an
 * approved claim can never overfill the week once it is published.
 */

import { db } from "@repo/database";
import {
    organization,
    scheduledNotification,
    shift,
    shiftAssignment,
    shiftRequest,
    timeOffRequest,
    worker,
    workerNotificationPreferences,
} from "@repo/database/schema";
import { AppError } from "@repo/observability";
import { buildNotificationSchedule } from "@repo/notifications";
import type { RequestShift } from "@repo/contracts/requests";
import { and, eq, gt, inArray, lt, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { ZodType } from "zod";

import { compactRange, compactTime, dayName } from "../../domain/labels";
import { canonicalizeCrewRole, deriveCrewRoles } from "../../utils/crew-roles";
import { newId } from "../../utils/ids";
import { localDateInZone, localTimeInZone } from "../../utils/zoned-time";
import { DEAD_ASSIGNMENT, type Tx } from "../scheduler/changes";

export type Q = Tx | typeof db;

export const PENDING_SHIFT_REQUEST = ["pending_peer", "pending_manager"] as const;
/** Shift statuses staff can see and still change hands before the shift starts. */
export const LIVE_SHIFT = ["published", "open", "assigned"] as const;
const DEAD = [...DEAD_ASSIGNMENT];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parse<T>(schema: ZodType<T>, input: unknown): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        throw new AppError(parsed.error.issues[0]?.message ?? "Validation failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }
    return parsed.data;
}

/** "Tue Sep 29, 4p–11p", in the shift's own timezone. */
export function whenLabel(start: Date, end: Date, tz: string) {
    const date = localDateInZone(start, tz);
    const [, month, day] = date.split("-").map(Number) as [number, number, number];
    return `${dayName(date)} ${MONTHS[month - 1]} ${day}, ${compactRange(localTimeInZone(start, tz), localTimeInZone(end, tz))}`;
}

/** "Tue Sep 29" or "Tue Sep 29 – Thu Oct 1" for whole days, otherwise the exact times. */
export function timeOffLabel(start: Date, end: Date, allDay: boolean, tz: string) {
    if (!allDay) {
        const sameDay = localDateInZone(start, tz) === localDateInZone(new Date(end.getTime() - 1), tz);
        return sameDay ? whenLabel(start, end, tz) : `${dateLabel(localDateInZone(start, tz))} ${localTimeLabel(start, tz)} – ${dateLabel(localDateInZone(end, tz))} ${localTimeLabel(end, tz)}`;
    }
    const first = localDateInZone(start, tz);
    const last = localDateInZone(new Date(end.getTime() - 1), tz);
    return first === last ? dateLabel(first) : `${dateLabel(first)} – ${dateLabel(last)}`;
}

function dateLabel(localDate: string) {
    const [, month, day] = localDate.split("-").map(Number) as [number, number, number];
    return `${dayName(localDate)} ${MONTHS[month - 1]} ${day}`;
}

const localTimeLabel = (instant: Date, tz: string) => compactTime(localTimeInZone(instant, tz));

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

const shiftWith = {
    // `worker.userId` is the app account, which is who requests are about.
    assignments: { columns: { id: true, workerId: true, status: true, pendingState: true }, with: { worker: { columns: { userId: true } } } },
    location: { columns: { id: true, name: true, timezone: true } },
    event: { columns: { name: true } },
    organization: { columns: { id: true, name: true, timezone: true, openShiftClaimPolicy: true, swapApprovalRequired: true } },
} as const;

export async function findShifts(q: Q, where: SQL | undefined) {
    return q.query.shift.findMany({ where, with: shiftWith });
}

export type LoadedShift = Awaited<ReturnType<typeof findShifts>>[number];

export async function loadShift(q: Q, shiftId: string): Promise<LoadedShift> {
    const row = await q.query.shift.findFirst({ where: eq(shift.id, shiftId), with: shiftWith });
    if (!row) throw new AppError("Shift not found", "SHIFT_NOT_FOUND", 404);
    return row;
}

export const tzOf = (row: LoadedShift) => row.timezone || row.location?.timezone || row.organization?.timezone || "UTC";

export function requestShiftOf(row: LoadedShift): RequestShift {
    return {
        id: row.id,
        role: row.title,
        startTime: row.startTime.toISOString(),
        endTime: row.endTime.toISOString(),
        timezone: tzOf(row),
        locationId: row.locationId,
        locationName: row.location?.name ?? null,
        eventName: row.event?.name ?? null,
    };
}

export const shiftLabel = (row: LoadedShift) => `${whenLabel(row.startTime, row.endTime, tzOf(row))} ${row.title}`;

export const liveAssignments = (row: LoadedShift) => row.assignments.filter((a) => !DEAD_ASSIGNMENT.has(a.status));

/** Spots left: the smaller of the published and staged headcount, less everyone on it or staged onto it. */
export function openSlotsOf(row: LoadedShift) {
    const capacity = Math.min(row.capacityTotal, row.pendingPatch?.capacityTotal ?? row.capacityTotal);
    return Math.max(0, capacity - liveAssignments(row).length);
}

/**
 * Requests are made by app accounts, so this package's request code names
 * people by user id and translates to the worker row only where it touches
 * assignments.
 */
export const accountOf = (a: LoadedShift["assignments"][number]) => a.worker?.userId ?? null;

/** True when this account is on the shift (even if only staged onto it). */
export const hasAccountOn = (row: LoadedShift, userId: string) => liveAssignments(row).some((a) => accountOf(a) === userId);

/** On the shift as staff see it (not merely staged onto it by a manager). */
export const isOnShift = (row: LoadedShift, userId: string) =>
    liveAssignments(row).some((a) => accountOf(a) === userId && a.pendingState !== "add");

/** The worker row an app account is, at one business. */
export async function workerIdOf(q: Q, orgId: string, userId: string) {
    const row = await q.query.worker.findFirst({
        where: and(eq(worker.organizationId, orgId), eq(worker.userId, userId)),
        columns: { id: true },
    });
    if (!row) throw new AppError("You don't work here", "NOT_A_MEMBER", 403);
    return row.id;
}

/** Still something a worker can ask about: published, not being removed, not started. */
export function assertChangeable(row: LoadedShift, now: Date) {
    if (!(LIVE_SHIFT as readonly string[]).includes(row.status) || row.pendingPatch?.cancel) {
        throw new AppError("This shift isn't on the schedule anymore", "SHIFT_NOT_AVAILABLE", 409);
    }
    if (row.startTime <= now) {
        throw new AppError("This shift has already started", "SHIFT_STARTED", 409);
    }
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export async function membershipsOf(q: Q, userId: string) {
    return q.query.worker.findMany({
        where: and(eq(worker.userId, userId), eq(worker.status, "active")),
        columns: { organizationId: true, jobTitle: true },
        with: { organization: { columns: { id: true, name: true, timezone: true, openShiftClaimPolicy: true, swapApprovalRequired: true } } },
    });
}

export async function requireMember(q: Q, orgId: string, userId: string) {
    const row = await q.query.worker.findFirst({
        where: and(eq(worker.organizationId, orgId), eq(worker.userId, userId), eq(worker.status, "active")),
        columns: { id: true, jobTitle: true, name: true },
    });
    if (!row) throw new AppError("You don't work here", "NOT_A_MEMBER", 403);
    return { id: row.id, jobTitle: row.jobTitle, user: { id: userId, name: row.name } };
}

/** Each person's roles at one workplace, as the Scheduler reads them, by app account. */
export async function rolesOf(q: Q, orgId: string, workers: { id: string; jobTitle?: string | null }[]) {
    const ids = workers.map((w) => w.id);
    const rows = ids.length
        ? await q.query.worker.findMany({ where: and(eq(worker.organizationId, orgId), inArray(worker.userId, ids)), columns: { userId: true, roles: true, jobTitle: true } })
        : [];
    const byUser = new Map(rows.map((r) => [r.userId, r] as const));
    return new Map(workers.map((w) => {
        const r = byUser.get(w.id);
        return [w.id, deriveCrewRoles(r?.roles ?? [], r?.jobTitle ?? w.jobTitle)] as const;
    }));
}

/** Someone with no roles set yet can take anything; otherwise the role has to be one of theirs. */
export function canWork(roles: string[], role: string) {
    if (roles.length === 1 && roles[0] === "General") return true;
    const wanted = (canonicalizeCrewRole(role) ?? role).toLowerCase();
    return roles.some((r) => r.toLowerCase() === wanted);
}

export interface BusyWindow {
    shiftId: string;
    start: Date;
    end: Date;
    label: string;
}

/**
 * Everything each person is booked on between two instants, at every
 * workplace: shifts they're on or staged onto, and approved time off.
 */
export async function busyWindows(q: Q, workerIds: string[], from: Date, to: Date): Promise<Map<string, BusyWindow[]>> {
    const busy = new Map<string, BusyWindow[]>(workerIds.map((id) => [id, []]));
    if (!workerIds.length) return busy;
    const [shifts, off] = await Promise.all([
        q
            .select({
                workerId: worker.userId,
                shiftId: shift.id,
                start: shift.startTime,
                end: shift.endTime,
                title: shift.title,
                timezone: shift.timezone,
                orgName: organization.name,
                orgTimezone: organization.timezone,
            })
            .from(shiftAssignment)
            .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
            .innerJoin(worker, eq(shiftAssignment.workerId, worker.id))
            .innerJoin(organization, eq(shift.organizationId, organization.id))
            .where(
                and(
                    inArray(worker.userId, workerIds),
                    notInArray(shiftAssignment.status, DEAD),
                    sql`${shiftAssignment.pendingState} is distinct from 'remove'`,
                    ne(shift.status, "cancelled"),
                    lt(shift.startTime, to),
                    gt(shift.endTime, from),
                ),
            ),
        q
            .select({ workerId: timeOffRequest.workerId, start: timeOffRequest.startTime, end: timeOffRequest.endTime })
            .from(timeOffRequest)
            .where(
                and(
                    inArray(timeOffRequest.workerId, workerIds),
                    eq(timeOffRequest.status, "approved"),
                    lt(timeOffRequest.startTime, to),
                    gt(timeOffRequest.endTime, from),
                ),
            ),
    ]);
    for (const s of shifts) {
        if (!s.workerId) continue;
        const tz = s.timezone || s.orgTimezone || "UTC";
        busy.get(s.workerId)?.push({
            shiftId: s.shiftId,
            start: s.start,
            end: s.end,
            label: `on ${s.title} ${compactRange(localTimeInZone(s.start, tz), localTimeInZone(s.end, tz))} at ${s.orgName}`,
        });
    }
    for (const t of off) busy.get(t.workerId)?.push({ shiftId: "", start: t.start, end: t.end, label: "off then" });
    return busy;
}

export const clash = (windows: BusyWindow[] | undefined, row: { id: string; startTime: Date; endTime: Date }) =>
    (windows ?? []).find((w) => w.shiftId !== row.id && w.start < row.endTime && w.end > row.startTime) ?? null;

// ---------------------------------------------------------------------------
// Live changes
// ---------------------------------------------------------------------------

/** Serialises changes to one shift's people, so two claims can't both take the last spot. */
export async function lockShift(tx: Tx, shiftId: string) {
    await tx.execute(sql`select ${shift.id} from ${shift} where ${shift.id} = ${shiftId} for update`);
}

export async function putOnShift(tx: Tx, row: LoadedShift, userId: string, now: Date) {
    const workerId = await workerIdOf(tx, row.organizationId, userId);
    const existing = row.assignments.find((a) => a.workerId === workerId);
    if (existing) {
        await tx.update(shiftAssignment).set({ status: "active", pendingState: null, updatedAt: now }).where(eq(shiftAssignment.id, existing.id));
    } else {
        await tx.insert(shiftAssignment).values({ id: newId("asg"), shiftId: row.id, workerId, status: "active", pendingState: null });
    }
}

export async function takeOffShift(tx: Tx, row: LoadedShift, userId: string, now: Date) {
    const workerId = await workerIdOf(tx, row.organizationId, userId);
    await tx
        .update(shiftAssignment)
        .set({ status: "removed", pendingState: null, updatedAt: now })
        .where(and(eq(shiftAssignment.shiftId, row.id), eq(shiftAssignment.workerId, workerId)));
    await tx
        .update(scheduledNotification)
        .set({ status: "cancelled", updatedAt: now })
        .where(and(eq(scheduledNotification.shiftId, row.id), eq(scheduledNotification.workerId, userId), eq(scheduledNotification.status, "pending")));
}

/** "assigned" once everyone staff can see fills it, "published" while spots are open. */
export async function syncFullness(tx: Tx, shiftId: string, now: Date) {
    const visible = sql`(
        select count(*) from ${shiftAssignment}
        where ${shiftAssignment.shiftId} = ${shift.id}
          and ${shiftAssignment.status} not in ('removed', 'cancelled')
          and ${shiftAssignment.pendingState} is distinct from 'add'
    )`;
    await tx
        .update(shift)
        .set({ status: sql`case when ${visible} >= ${shift.capacityTotal} then 'assigned' else 'published' end`, updatedAt: now })
        .where(and(eq(shift.id, shiftId), inArray(shift.status, [...LIVE_SHIFT])));
}

/** Timed reminders for someone joining a shift (the request's own message replaces "new shift"). */
export async function remindersFor(q: Q, row: LoadedShift, workerId: string): Promise<NotificationRow[]> {
    const prefs = await q.query.workerNotificationPreferences.findFirst({ where: eq(workerNotificationPreferences.workerId, workerId) });
    const schedule = await buildNotificationSchedule(
        workerId,
        row.id,
        row.organizationId,
        row.startTime,
        row.title,
        row.location?.name ?? row.organization?.name ?? "",
        prefs
            ? {
                  nightBeforeEnabled: prefs.nightBeforeEnabled ?? true,
                  sixtyMinEnabled: prefs.sixtyMinEnabled ?? true,
                  fifteenMinEnabled: prefs.fifteenMinEnabled ?? true,
                  shiftStartEnabled: prefs.shiftStartEnabled ?? true,
                  lateWarningEnabled: prefs.lateWarningEnabled ?? true,
                  quietHoursEnabled: prefs.quietHoursEnabled ?? false,
                  quietHoursStart: prefs.quietHoursStart,
                  quietHoursEnd: prefs.quietHoursEnd,
              }
            : undefined,
    );
    return schedule.filter((n) => n.type !== "assignment_created");
}

export type NotificationRow = typeof scheduledNotification.$inferInsert;

/** A push sent now, opening the app's Requests tab. */
export function message(input: { workerId: string; orgId: string; title: string; body: string; type?: string; now: Date }): NotificationRow {
    const type = input.type ?? "request_update";
    return {
        id: nanoid(),
        workerId: input.workerId,
        shiftId: null,
        organizationId: input.orgId,
        type,
        title: input.title,
        body: input.body,
        data: { type, url: "/(tabs)/requests" },
        scheduledAt: input.now,
        status: "pending",
    };
}

export async function queue(q: Q, rows: NotificationRow[]) {
    for (let i = 0; i < rows.length; i += 100) await q.insert(scheduledNotification).values(rows.slice(i, i + 100));
}

/** Waiting requests for shifts that started or went away can't be granted anymore. */
export async function expireStaleRequests(q: Q, scope: { orgId?: string; workerId?: string }, now: Date) {
    const stale = q
        .select({ id: shift.id })
        .from(shift)
        .where(or(lte(shift.startTime, now), eq(shift.status, "cancelled")));
    await q
        .update(shiftRequest)
        .set({ status: "expired", updatedAt: now })
        .where(
            and(
                inArray(shiftRequest.status, [...PENDING_SHIFT_REQUEST]),
                inArray(shiftRequest.shiftId, stale),
                scope.orgId ? eq(shiftRequest.organizationId, scope.orgId) : undefined,
                scope.workerId ? or(eq(shiftRequest.requesterWorkerId, scope.workerId), eq(shiftRequest.targetWorkerId, scope.workerId)) : undefined,
            ),
        );
}

/** A coworker at the same workplace who could take a shift: signed in and active. */
export async function findCoworker(q: Q, orgId: string, userId: string) {
    const row = await q.query.worker.findFirst({
        where: and(eq(worker.organizationId, orgId), eq(worker.userId, userId), eq(worker.status, "active")),
        columns: { jobTitle: true, name: true },
    });
    if (!row) throw new AppError("That person doesn't work here", "NOT_A_MEMBER", 404);
    return { jobTitle: row.jobTitle, user: { id: userId, name: row.name } };
}

/** The shift changes hands: one person off, the other on, reminders moved. */
export async function applySwap(
    tx: Tx,
    input: { requestId: string; row: LoadedShift; fromId: string; toId: string; decidedBy: string | null; now: Date },
) {
    const { row, now } = input;
    await takeOffShift(tx, row, input.fromId, now);
    await putOnShift(tx, row, input.toId, now);
    await syncFullness(tx, row.id, now);
    await queue(tx, await remindersFor(tx, row, input.toId));
    await tx
        .update(shiftRequest)
        .set({ status: "approved", decidedBy: input.decidedBy, decidedAt: now, updatedAt: now })
        .where(eq(shiftRequest.id, input.requestId));
}
