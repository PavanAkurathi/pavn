// packages/scheduling-timekeeping/src/modules/scheduler/changes.ts

/**
 * Every edit the Scheduler makes goes through here: a batch of small changes
 * (create, update, delete, assign) applied in one transaction.
 *
 * The rules that keep staff from seeing half-finished work live here too:
 * - New shifts are drafts. Drafts change directly and are deleted outright.
 * - Changes to a published shift are staged: times, role, headcount, break and
 *   notes go into `pending_patch`, people into `pending_state`, and a removal
 *   into `pending_patch.cancel`. Staff keep seeing the published version until
 *   the week is published.
 * - Nothing blocks a draft, but putting someone where they are double-booked
 *   or on approved time off needs `force`, and that is audited.
 *
 * Each batch returns the changes that undo it, computed from the state it
 * replaced, so the grid's undo and redo are just more batches.
 */

import { db, logAudit } from "@repo/database";
import {
    location,
    organization,
    scheduleEvent,
    shift,
    shiftAssignment,
    timeOffRequest,
    worker,
    type ShiftPendingPatch,
} from "@repo/database/schema";
import { AppError } from "@repo/observability";
import {
    SchedulerChangesInputSchema,
    SchedulerWeekScopeSchema,
    type SchedulerBlockingConflict,
    type SchedulerChange,
    type SchedulerChangesResult,
    type SchedulerDiscardResult,
    type SchedulerPersonRef,
    type SchedulerShiftPatch,
} from "@repo/contracts/scheduler";
import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import type { ZodType } from "zod";

import { evaluateConflicts } from "../../domain/conflicts";
import { compactRange, dayName } from "../../domain/labels";
import { startOfLocalWeek, weekBounds } from "../../domain/week";
import { newId } from "../../utils/ids";
import { addDaysToLocalDate, combineDateTimeTz, localDateInZone, localTimeInZone } from "../../utils/zoned-time";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Statuses the Scheduler may change. Started or finished shifts belong to timesheets. */
export const EDITABLE = new Set(["draft", "published", "open", "assigned"]);
export const DEAD_ASSIGNMENT = new Set(["removed", "cancelled"]);
const DAY_MS = 24 * 60 * 60 * 1000;

function parse<T>(schema: ZodType<T>, input: unknown): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        throw new AppError(parsed.error.issues[0]?.message ?? "Validation failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }
    return parsed.data;
}

// ---- Shapes -------------------------------------------------------------------

export type AssignmentRow = {
    id: string;
    workerId: string;
    status: string;
    pendingState: string | null;
};

export type ShiftRow = {
    id: string;
    locationId: string | null;
    title: string;
    description: string | null;
    startTime: Date;
    endTime: Date;
    timezone: string | null;
    capacityTotal: number;
    status: string;
    breakMinutes: number;
    eventId: string | null;
    pendingPatch: ShiftPendingPatch | null;
    managerNote: string | null;
    assignments: AssignmentRow[];
};

/** A shift as the manager sees it: the published row with staged edits on top. */
export function workingCopy(row: ShiftRow) {
    const p = row.pendingPatch ?? {};
    return {
        start: p.startTime ? new Date(p.startTime) : row.startTime,
        end: p.endTime ? new Date(p.endTime) : row.endTime,
        role: p.title ?? row.title,
        capacity: p.capacityTotal ?? row.capacityTotal,
        breakMinutes: p.breakMinutes ?? row.breakMinutes ?? 0,
        note: p.description !== undefined ? p.description : row.description,
        eventId: p.eventId !== undefined ? p.eventId : row.eventId,
        cancel: Boolean(p.cancel),
    };
}

const keyOf = (ref: SchedulerPersonRef) => ref.personId;

export function refOf(a: AssignmentRow): SchedulerPersonRef {
    return { personId: a.workerId };
}

function dedupe(refs: SchedulerPersonRef[]) {
    const seen = new Map<string, SchedulerPersonRef>();
    for (const ref of refs) seen.set(keyOf(ref), ref);
    return [...seen.values()];
}

/** Wall-clock times on a date; an end at or before the start is the next day. */
export function shiftInstants(localDate: string, startLocal: string, endLocal: string, tz: string) {
    if (startLocal === endLocal) {
        throw new AppError("A shift can't start and end at the same time", "VALIDATION_ERROR", 400);
    }
    const start = combineDateTimeTz(localDate, startLocal, tz);
    const endDate = endLocal < startLocal ? addDaysToLocalDate(localDate, 1) : localDate;
    return { start, end: combineDateTimeTz(endDate, endLocal, tz) };
}

/** 30 minutes unpaid on anything over six hours, the common state default. */
export const defaultBreakMinutes = (start: Date, end: Date) => ((end.getTime() - start.getTime()) / 60000 > 360 ? 30 : 0);

const localFields = (start: Date, end: Date, tz: string) => ({
    localDate: localDateInZone(start, tz),
    startLocal: localTimeInZone(start, tz),
    endLocal: localTimeInZone(end, tz),
});

// ---- The batch ----------------------------------------------------------------

export interface ApplySchedulerChangesInput {
    orgId: string;
    actorId: string;
    body: unknown;
}

export async function applySchedulerChanges(input: ApplySchedulerChangesInput): Promise<SchedulerChangesResult> {
    const { changes, force } = parse(SchedulerChangesInputSchema, input.body);
    const { orgId } = input;

    const [org, locations] = await Promise.all([
        db.query.organization.findFirst({ where: eq(organization.id, orgId), columns: { timezone: true } }),
        db.query.location.findMany({ where: eq(location.organizationId, orgId), columns: { id: true, name: true, timezone: true } }),
    ]);
    if (!org) throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
    const locationById = new Map(locations.map((l) => [l.id, l]));
    const tzOf = (row: { timezone: string | null; locationId: string | null }) =>
        row.timezone || (row.locationId ? locationById.get(row.locationId)?.timezone : null) || org.timezone;

    const undo: SchedulerChange[] = [];
    const added: { shiftId: string; ref: SchedulerPersonRef }[] = [];
    const names = new Map<string, string>();
    let overridden: SchedulerBlockingConflict[] = [];

    await db.transaction(async (tx) => {
        for (const change of changes) {
            const inverse = await applyOne(tx, orgId, change, { locationById, tzOf, added, names, actorId: input.actorId });
            if (inverse) undo.unshift(...(Array.isArray(inverse) ? inverse : [inverse]));
        }

        const conflicts = await findBlockingConflicts(tx, orgId, added, { locationById, tzOf, names });
        if (conflicts.length && !force) {
            throw new AppError(
                conflicts.length === 1
                    ? `${conflicts[0]!.personName}: ${conflicts[0]!.messages.join("; ")}`
                    : `${conflicts.length} people would be double-booked or on time off`,
                "SCHEDULE_CONFLICT",
                409,
                { conflicts },
            );
        }
        overridden = conflicts;
    });

    for (const conflict of overridden) {
        await logAudit({
            action: "schedule.conflict_override",
            entityType: "shift",
            entityId: conflict.shiftId,
            actorId: input.actorId,
            organizationId: orgId,
            metadata: { personId: conflict.personId, messages: conflict.messages },
        });
    }

    return { undo, overridden };
}

export interface Ctx {
    actorId?: string;
    locationById: Map<string, { id: string; name: string; timezone: string | null }>;
    tzOf: (row: { timezone: string | null; locationId: string | null }) => string;
    added: { shiftId: string; ref: SchedulerPersonRef }[];
    names: Map<string, string>;
}

async function loadShift(tx: Tx, orgId: string, shiftId: string): Promise<ShiftRow> {
    const row = await tx.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
        with: {
            assignments: {
                columns: { id: true, workerId: true, status: true, pendingState: true },
            },
        },
    });
    if (!row) throw new AppError("Shift not found", "SHIFT_NOT_FOUND", 404);
    if (!EDITABLE.has(row.status)) {
        throw new AppError("This shift has started or finished; change it from its timesheet", "SHIFT_LOCKED", 409);
    }
    return row as unknown as ShiftRow;
}

async function verifyPeople(tx: Tx, orgId: string, refs: SchedulerPersonRef[], names: Map<string, string>) {
    if (!refs.length) return new Map<string, { id: string; name: string; status: string }>();
    const people = await tx
        .select({ id: worker.id, name: worker.name, status: worker.status })
        .from(worker)
        .where(and(eq(worker.organizationId, orgId), inArray(worker.id, refs.map((r) => r.personId))));
    const found = new Map(people.map((p) => [p.id, p] as const));
    for (const ref of refs) {
        const person = found.get(ref.personId);
        if (person === undefined) throw new AppError("That person isn't in this organization", "PERSON_NOT_FOUND", 404);
        names.set(keyOf(ref), person.name);
    }
    return found;
}

async function verifyEvent(tx: Tx, orgId: string, eventId: string | null | undefined, locationId: string | null) {
    if (!eventId) return;
    const event = await tx.query.scheduleEvent.findFirst({
        where: and(eq(scheduleEvent.id, eventId), eq(scheduleEvent.organizationId, orgId)),
        columns: { locationId: true },
    });
    if (!event || (locationId && event.locationId !== locationId)) {
        throw new AppError("Event not found at this location", "EVENT_NOT_FOUND", 404);
    }
}

async function insertAssignments(tx: Tx, shiftId: string, refs: SchedulerPersonRef[], pendingState: "add" | null) {
    if (!refs.length) return;
    await tx.insert(shiftAssignment).values(
        refs.map((ref) => ({ id: newId("asg"), shiftId, status: "active", pendingState, workerId: ref.personId })),
    );
}

async function loadEvent(tx: Tx, orgId: string, eventId: string) {
    const event = await tx.query.scheduleEvent.findFirst({
        where: and(eq(scheduleEvent.id, eventId), eq(scheduleEvent.organizationId, orgId)),
    });
    if (!event) throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);
    return event;
}

async function applyOne(tx: Tx, orgId: string, change: SchedulerChange, ctx: Ctx): Promise<SchedulerChange | SchedulerChange[] | null> {
    switch (change.op) {
        case "createEvent": {
            const f = change.event;
            const loc = ctx.locationById.get(f.locationId);
            if (!loc) throw new AppError("Location not found", "LOCATION_NOT_FOUND", 404);
            const tz = ctx.tzOf({ timezone: loc.timezone, locationId: loc.id });
            const { start, end } = shiftInstants(f.localDate, f.startLocal, f.endLocal, tz);
            const taken = await tx.query.scheduleEvent.findFirst({ where: eq(scheduleEvent.id, change.eventId), columns: { id: true } });
            if (taken) throw new AppError("That event already exists", "EVENT_EXISTS", 409);
            await tx.insert(scheduleEvent).values({
                id: change.eventId,
                organizationId: orgId,
                locationId: loc.id,
                name: f.name,
                startTime: start,
                endTime: end,
                notes: f.notes ?? null,
                createdBy: ctx.actorId && ctx.actorId !== "unknown" ? ctx.actorId : null,
            });
            return { op: "deleteEvent", eventId: change.eventId };
        }

        case "updateEvent": {
            const event = await loadEvent(tx, orgId, change.eventId);
            const tz = ctx.tzOf({ timezone: null, locationId: event.locationId });
            const current = localFields(event.startTime, event.endTime, tz);
            const p = change.patch;
            const { start, end } =
                p.localDate !== undefined || p.startLocal !== undefined || p.endLocal !== undefined
                    ? shiftInstants(p.localDate ?? current.localDate, p.startLocal ?? current.startLocal, p.endLocal ?? current.endLocal, tz)
                    : { start: event.startTime, end: event.endTime };
            await tx
                .update(scheduleEvent)
                .set({
                    name: p.name ?? event.name,
                    notes: p.notes !== undefined ? p.notes : event.notes,
                    startTime: start,
                    endTime: end,
                    updatedAt: new Date(),
                })
                .where(eq(scheduleEvent.id, event.id));
            const previous: Record<string, unknown> = {};
            if (p.name !== undefined) previous.name = event.name;
            if (p.notes !== undefined) previous.notes = event.notes;
            if (p.localDate !== undefined) previous.localDate = current.localDate;
            if (p.startLocal !== undefined) previous.startLocal = current.startLocal;
            if (p.endLocal !== undefined) previous.endLocal = current.endLocal;
            return { op: "updateEvent", eventId: event.id, patch: previous };
        }

        case "deleteEvent": {
            const event = await loadEvent(tx, orgId, change.eventId);
            const tz = ctx.tzOf({ timezone: null, locationId: event.locationId });
            // Shifts keep existing; they just stop pointing at the event. Staged
            // links go too, so publishing later can't point at a deleted event.
            const linked = await tx.query.shift.findMany({
                where: and(eq(shift.organizationId, orgId), eq(shift.eventId, event.id)),
                columns: { id: true },
            });
            const staged = await tx.query.shift.findMany({
                where: and(eq(shift.organizationId, orgId), sql`${shift.pendingPatch}->>'eventId' = ${event.id}`),
                columns: { id: true, pendingPatch: true },
            });
            for (const row of staged) {
                const patch = { ...(row.pendingPatch ?? {}) };
                delete patch.eventId;
                await tx.update(shift).set({ pendingPatch: Object.keys(patch).length ? patch : null }).where(eq(shift.id, row.id));
            }
            await tx.delete(scheduleEvent).where(eq(scheduleEvent.id, event.id));
            return [
                {
                    op: "createEvent",
                    eventId: event.id,
                    event: { locationId: event.locationId, ...localFields(event.startTime, event.endTime, tz), name: event.name, notes: event.notes },
                },
                ...[...linked, ...staged].map((row) => ({ op: "update" as const, shiftId: row.id, patch: { eventId: event.id } })),
            ];
        }

        case "create": {
            const f = change.shift;
            const loc = ctx.locationById.get(f.locationId);
            if (!loc) throw new AppError("Location not found", "LOCATION_NOT_FOUND", 404);
            const tz = ctx.tzOf({ timezone: loc.timezone, locationId: loc.id });
            const { start, end } = shiftInstants(f.localDate, f.startLocal, f.endLocal, tz);
            const capacity = f.capacity ?? 1;
            const people = dedupe(change.assignees ?? []);
            if (people.length > capacity) throw new AppError(`This shift is for ${capacity}`, "CAPACITY_FULL", 409);
            await verifyEvent(tx, orgId, f.eventId, loc.id);
            await verifyPeople(tx, orgId, people, ctx.names);

            const taken = await tx.query.shift.findFirst({ where: eq(shift.id, change.shiftId), columns: { id: true } });
            if (taken) throw new AppError("That shift already exists", "SHIFT_EXISTS", 409);

            await tx.insert(shift).values({
                id: change.shiftId,
                organizationId: orgId,
                locationId: loc.id,
                title: f.role,
                description: f.note ?? null,
                managerNote: f.managerNote ?? null,
                startTime: start,
                endTime: end,
                timezone: tz,
                capacityTotal: capacity,
                status: "draft",
                breakMinutes: f.breakMinutes ?? defaultBreakMinutes(start, end),
                eventId: f.eventId ?? null,
            });
            await insertAssignments(tx, change.shiftId, people, null);
            for (const ref of people) ctx.added.push({ shiftId: change.shiftId, ref });
            return { op: "delete", shiftId: change.shiftId };
        }

        case "update": {
            const row = await loadShift(tx, orgId, change.shiftId);
            const tz = ctx.tzOf(row);
            const ws = workingCopy(row);
            const p: SchedulerShiftPatch = change.patch;
            const current = localFields(ws.start, ws.end, tz);

            const timesChange = p.localDate !== undefined || p.startLocal !== undefined || p.endLocal !== undefined;
            const { start, end } = timesChange
                ? shiftInstants(p.localDate ?? current.localDate, p.startLocal ?? current.startLocal, p.endLocal ?? current.endLocal, tz)
                : { start: ws.start, end: ws.end };
            const next = {
                role: p.role ?? ws.role,
                capacity: p.capacity ?? ws.capacity,
                breakMinutes: p.breakMinutes ?? ws.breakMinutes,
                note: p.note !== undefined ? p.note : ws.note,
                eventId: p.eventId !== undefined ? p.eventId : ws.eventId,
            };

            const staying = row.assignments.filter((a) => !DEAD_ASSIGNMENT.has(a.status) && a.pendingState !== "remove").length;
            if (next.capacity < staying) {
                throw new AppError(`${staying} people are on this shift; take someone off first`, "CAPACITY_BELOW_ASSIGNED", 409);
            }
            if (p.eventId) await verifyEvent(tx, orgId, p.eventId, row.locationId);

            // The inverse carries back exactly the fields this change touched.
            const previous: SchedulerShiftPatch = {};
            if (p.localDate !== undefined) previous.localDate = current.localDate;
            if (p.startLocal !== undefined) previous.startLocal = current.startLocal;
            if (p.endLocal !== undefined) previous.endLocal = current.endLocal;
            if (p.role !== undefined) previous.role = ws.role;
            if (p.capacity !== undefined) previous.capacity = ws.capacity;
            if (p.breakMinutes !== undefined) previous.breakMinutes = ws.breakMinutes;
            if (p.note !== undefined) previous.note = ws.note;
            if (p.managerNote !== undefined) previous.managerNote = row.managerNote;
            if (p.eventId !== undefined) previous.eventId = ws.eventId;
            if (p.cancel !== undefined) previous.cancel = ws.cancel;

            if (row.status === "draft") {
                if (p.cancel) throw new AppError("Delete a draft instead of cancelling it", "VALIDATION_ERROR", 400);
                await tx
                    .update(shift)
                    .set({
                        startTime: start,
                        endTime: end,
                        title: next.role,
                        capacityTotal: next.capacity,
                        breakMinutes: next.breakMinutes,
                        description: next.note,
                        eventId: next.eventId,
                        ...(p.managerNote !== undefined ? { managerNote: p.managerNote } : {}),
                        updatedAt: new Date(),
                    })
                    .where(eq(shift.id, row.id));
            } else {
                // Stage against the published row; a value put back to what staff
                // already see stops being a change.
                const patch: ShiftPendingPatch = { ...(row.pendingPatch ?? {}) };
                const stage = <K extends keyof ShiftPendingPatch>(key: K, value: ShiftPendingPatch[K], published: ShiftPendingPatch[K]) => {
                    if (value === published) delete patch[key];
                    else patch[key] = value;
                };
                stage("startTime", start.toISOString(), row.startTime.toISOString());
                stage("endTime", end.toISOString(), row.endTime.toISOString());
                stage("title", next.role, row.title);
                stage("capacityTotal", next.capacity, row.capacityTotal);
                stage("breakMinutes", next.breakMinutes, row.breakMinutes);
                stage("description", next.note, row.description);
                stage("eventId", next.eventId, row.eventId);
                if (p.cancel === true) patch.cancel = true;
                if (p.cancel === false) delete patch.cancel;

                await tx
                    .update(shift)
                    .set({
                        pendingPatch: Object.keys(patch).length ? patch : null,
                        ...(p.managerNote !== undefined ? { managerNote: p.managerNote } : {}),
                        updatedAt: new Date(),
                    })
                    .where(eq(shift.id, row.id));
            }
            return { op: "update", shiftId: row.id, patch: previous };
        }

        case "delete": {
            const row = await loadShift(tx, orgId, change.shiftId);
            const ws = workingCopy(row);
            if (row.status !== "draft") {
                await tx
                    .update(shift)
                    .set({ pendingPatch: { ...(row.pendingPatch ?? {}), cancel: true }, updatedAt: new Date() })
                    .where(eq(shift.id, row.id));
                return { op: "update", shiftId: row.id, patch: { cancel: ws.cancel } };
            }
            if (!row.locationId) throw new AppError("This draft has no location; delete it from Shifts", "VALIDATION_ERROR", 400);
            const people = row.assignments
                .filter((a) => !DEAD_ASSIGNMENT.has(a.status))
                .map(refOf);
            await tx.delete(shift).where(eq(shift.id, row.id));
            return {
                op: "create",
                shiftId: row.id,
                shift: {
                    locationId: row.locationId,
                    ...localFields(ws.start, ws.end, ctx.tzOf(row)),
                    role: ws.role,
                    capacity: ws.capacity,
                    breakMinutes: ws.breakMinutes,
                    note: ws.note,
                    managerNote: row.managerNote,
                    eventId: ws.eventId,
                },
                assignees: people,
            };
        }

        case "assign": {
            const row = await loadShift(tx, orgId, change.shiftId);
            const ws = workingCopy(row);
            const desired = dedupe(change.assignees);
            if (desired.length > ws.capacity) {
                throw new AppError(`This shift is for ${ws.capacity}; add a spot first`, "CAPACITY_FULL", 409);
            }
            const people = await verifyPeople(tx, orgId, desired, ctx.names);

            const draft = row.status === "draft";
            const wanted = new Set(desired.map(keyOf));
            const rowsByKey = new Map<string, AssignmentRow>();
            for (const a of row.assignments) {
                rowsByKey.set(keyOf(refOf(a)), a);
            }
            const previous = row.assignments
                .filter((a) => !DEAD_ASSIGNMENT.has(a.status) && a.pendingState !== "remove")
                .map(refOf);

            for (const [key, a] of rowsByKey) {
                if (DEAD_ASSIGNMENT.has(a.status) || wanted.has(key)) continue;
                if (draft || a.pendingState === "add") {
                    await tx.delete(shiftAssignment).where(eq(shiftAssignment.id, a.id));
                } else if (a.pendingState !== "remove") {
                    await tx.update(shiftAssignment).set({ pendingState: "remove", updatedAt: new Date() }).where(eq(shiftAssignment.id, a.id));
                }
            }

            // Someone paused can stay on shifts they already have, but cannot be put on new ones.
            const assertSchedulable = (ref: SchedulerPersonRef) => {
                if (people.get(ref.personId)?.status === "inactive") {
                    throw new AppError(`${people.get(ref.personId)!.name} is inactive. Reactivate them to schedule them.`, "INVALID_STATE", 409);
                }
            };

            const fresh: SchedulerPersonRef[] = [];
            for (const ref of desired) {
                const a = rowsByKey.get(keyOf(ref));
                if (!a) {
                    assertSchedulable(ref);
                    fresh.push(ref);
                } else if (DEAD_ASSIGNMENT.has(a.status)) {
                    assertSchedulable(ref);
                    // One row per worker per shift: bring the old one back.
                    await tx
                        .update(shiftAssignment)
                        .set({ status: "active", pendingState: draft ? null : "add", updatedAt: new Date() })
                        .where(eq(shiftAssignment.id, a.id));
                    ctx.added.push({ shiftId: row.id, ref });
                } else if (a.pendingState === "remove") {
                    await tx.update(shiftAssignment).set({ pendingState: null, updatedAt: new Date() }).where(eq(shiftAssignment.id, a.id));
                }
            }
            await insertAssignments(tx, row.id, fresh, draft ? null : "add");
            for (const ref of fresh) ctx.added.push({ shiftId: row.id, ref });

            return { op: "assign", shiftId: row.id, assignees: previous };
        }
    }
}

// ---- Conflicts ------------------------------------------------------------------

export async function findBlockingConflicts(
    tx: Tx,
    orgId: string,
    added: { shiftId: string; ref: SchedulerPersonRef }[],
    ctx: Pick<Ctx, "locationById" | "tzOf" | "names">,
): Promise<SchedulerBlockingConflict[]> {
    if (!added.length) return [];

    // The shifts people were just put on, as they stand after the batch.
    const targetIds = [...new Set(added.map((a) => a.shiftId))];
    const targets = new Map<string, ReturnType<typeof workingCopy> & { tz: string; locationId: string | null }>();
    for (const row of await tx.query.shift.findMany({ where: and(eq(shift.organizationId, orgId), inArray(shift.id, targetIds)) })) {
        const ws = workingCopy({ ...(row as unknown as ShiftRow), assignments: [] });
        if (!ws.cancel) targets.set(row.id, { ...ws, tz: ctx.tzOf(row), locationId: row.locationId });
    }

    const conflicts: SchedulerBlockingConflict[] = [];
    const byPerson = new Map<string, { ref: SchedulerPersonRef; shiftIds: string[] }>();
    for (const a of added) {
        if (!targets.has(a.shiftId)) continue;
        const entry = byPerson.get(keyOf(a.ref)) ?? { ref: a.ref, shiftIds: [] };
        entry.shiftIds.push(a.shiftId);
        byPerson.set(keyOf(a.ref), entry);
    }

    for (const { ref, shiftIds } of byPerson.values()) {
        const mine = shiftIds.map((id) => ({ id, ...targets.get(id)! }));
        // Wide enough to catch shifts whose staged times moved them into range.
        const from = new Date(Math.min(...mine.map((s) => s.start.getTime())) - 7 * DAY_MS);
        const to = new Date(Math.max(...mine.map((s) => s.end.getTime())) + 7 * DAY_MS);
        const identity = eq(shiftAssignment.workerId, ref.personId);

        const others = await tx
            .select({
                shiftId: shift.id,
                startTime: shift.startTime,
                endTime: shift.endTime,
                title: shift.title,
                timezone: shift.timezone,
                locationId: shift.locationId,
                pendingPatch: shift.pendingPatch,
                assignmentStatus: shiftAssignment.status,
                pendingState: shiftAssignment.pendingState,
            })
            .from(shiftAssignment)
            .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
            .where(and(eq(shift.organizationId, orgId), identity, ne(shift.status, "cancelled"), lt(shift.startTime, to), gt(shift.endTime, from)));

        const otherShifts = others
            .filter((o) => !DEAD_ASSIGNMENT.has(o.assignmentStatus) && o.pendingState !== "remove" && !o.pendingPatch?.cancel)
            .map((o) => {
                const start = o.pendingPatch?.startTime ? new Date(o.pendingPatch.startTime) : o.startTime;
                const end = o.pendingPatch?.endTime ? new Date(o.pendingPatch.endTime) : o.endTime;
                const tz = ctx.tzOf(o);
                const where = o.locationId ? ctx.locationById.get(o.locationId)?.name : null;
                return {
                    shiftId: o.shiftId,
                    start,
                    end,
                    locationId: o.locationId,
                    label: `${dayName(localDateInZone(start, tz))} ${compactRange(localTimeInZone(start, tz), localTimeInZone(end, tz))} ${o.pendingPatch?.title ?? o.title}`,
                    where,
                };
            });

        // Time off is requested from the worker's app account, so a worker
        // who has not signed in has none.
        const account = await tx.query.worker.findFirst({
            where: eq(worker.id, ref.personId),
            columns: { userId: true },
        });
        const timeOff =
            account?.userId
                ? (
                      await tx.query.timeOffRequest.findMany({
                          where: and(
                              eq(timeOffRequest.organizationId, orgId),
                              eq(timeOffRequest.workerId, account.userId),
                              eq(timeOffRequest.status, "approved"),
                              lt(timeOffRequest.startTime, to),
                              gt(timeOffRequest.endTime, from),
                          ),
                      })
                  ).map((t) => ({ start: t.startTime, end: t.endTime, status: "approved" as const, label: t.allDay ? "that day" : "then" }))
                : [];

        for (const target of mine) {
            const messages = evaluateConflicts(
                { shiftId: target.id, start: target.start, end: target.end, role: target.role },
                {
                    personRoles: [target.role],
                    otherShifts: otherShifts.map((o) => ({
                        ...o,
                        label: o.where && o.locationId !== target.locationId ? `${o.label} at ${o.where}` : o.label,
                    })),
                    timeOff,
                    unavailable: [],
                    addedOvertimeMinutes: 0,
                },
            )
                .filter((w) => w.severity === "block")
                .map((w) => w.message);
            if (messages.length) {
                conflicts.push({ shiftId: target.id, personId: ref.personId, personName: ctx.names.get(keyOf(ref)) ?? "Someone", messages });
            }
        }
    }
    return conflicts;
}

// ---- Discard --------------------------------------------------------------------

/**
 * Throws away everything unpublished at one location for one week: drafts go,
 * staged edits and people changes are reverted. Other weeks and locations are
 * untouched (the old "discard" deleted every draft in the organization).
 */
export async function discardSchedulerWeek(input: { orgId: string; body: unknown }): Promise<SchedulerDiscardResult> {
    const scope = parse(SchedulerWeekScopeSchema, input.body);
    const [org, loc] = await Promise.all([
        db.query.organization.findFirst({ where: eq(organization.id, input.orgId), columns: { timezone: true, weekStartsOn: true } }),
        db.query.location.findFirst({
            where: and(eq(location.id, scope.locationId), eq(location.organizationId, input.orgId)),
            columns: { id: true, timezone: true },
        }),
    ]);
    if (!org) throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
    if (!loc) throw new AppError("Location not found", "LOCATION_NOT_FOUND", 404);
    const tz = loc.timezone || org.timezone;
    const bounds = weekBounds(startOfLocalWeek(scope.weekStart, org.weekStartsOn ?? 0), tz);

    const result: SchedulerDiscardResult = { deletedDrafts: 0, revertedShifts: 0, revertedAssignments: 0 };
    await db.transaction(async (tx) => {
        const rows = await tx.query.shift.findMany({
            where: and(
                eq(shift.organizationId, input.orgId),
                eq(shift.locationId, loc.id),
                lt(shift.startTime, new Date(bounds.end.getTime() + 7 * DAY_MS)),
                gt(shift.endTime, new Date(bounds.start.getTime() - 7 * DAY_MS)),
            ),
            with: { assignments: { columns: { id: true, pendingState: true } } },
        });
        for (const row of rows) {
            const start = row.pendingPatch?.startTime ? new Date(row.pendingPatch.startTime) : row.startTime;
            if (start < bounds.start || start >= bounds.end) continue;
            if (row.status === "draft") {
                await tx.delete(shift).where(eq(shift.id, row.id));
                result.deletedDrafts++;
                continue;
            }
            if (!EDITABLE.has(row.status)) continue;
            if (row.pendingPatch) {
                await tx.update(shift).set({ pendingPatch: null, updatedAt: new Date() }).where(eq(shift.id, row.id));
                result.revertedShifts++;
            }
            for (const a of row.assignments) {
                if (a.pendingState === "add") {
                    await tx.delete(shiftAssignment).where(eq(shiftAssignment.id, a.id));
                    result.revertedAssignments++;
                } else if (a.pendingState === "remove") {
                    await tx.update(shiftAssignment).set({ pendingState: null, updatedAt: new Date() }).where(eq(shiftAssignment.id, a.id));
                    result.revertedAssignments++;
                }
            }
        }
    });
    return result;
}
