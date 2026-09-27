// packages/scheduling-timekeeping/src/modules/requests/manager.ts

/**
 * The manager's side of requests: one list of what's waiting (claims, drops,
 * swaps a coworker already accepted, and time off), each with what approving
 * would do, and approve / decline.
 *
 * Approving a claim or swap onto someone who is double-booked or on approved
 * time off needs `force`, exactly like the Scheduler grid, and is audited.
 */

import { db, logAudit } from "@repo/database";
import { location, organization, shift, shiftAssignment, shiftRequest, timeOffRequest, user } from "@repo/database/schema";
import { AppError } from "@repo/observability";
import {
    DecideRequestInputSchema,
    ManagerRequestsQuerySchema,
    type DecideRequestResult,
    type ManagerRequest,
    type ManagerRequestsResponse,
    type RequestStatus,
    type RequestsSummary,
} from "@repo/contracts/requests";
import { and, count, desc, eq, gt, gte, inArray, lt, ne, notInArray, sql } from "drizzle-orm";

import { compactHours } from "../../domain/labels";
import { startOfLocalWeek, weekBounds } from "../../domain/week";
import { localDateInZone } from "../../utils/zoned-time";
import { DEAD_ASSIGNMENT, findBlockingConflicts, type Ctx, type Tx } from "../scheduler/changes";
import {
    PENDING_SHIFT_REQUEST,
    applySwap,
    assertChangeable,
    expireStaleRequests,
    findShifts,
    isOnShift,
    liveAssignments,
    loadShift,
    lockShift,
    message,
    openSlotsOf,
    parse,
    putOnShift,
    queue,
    remindersFor,
    requestShiftOf,
    shiftLabel,
    syncFullness,
    takeOffShift,
    timeOffLabel,
    tzOf,
    whenLabel,
    type LoadedShift,
    type NotificationRow,
    type Q,
} from "./shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 14;
const WEEKLY_OVERTIME_MINUTES = 40 * 60;
const DEAD = [...DEAD_ASSIGNMENT];

type ConflictCtx = Pick<Ctx, "locationById" | "tzOf" | "names">;

async function orgContext(q: Q, orgId: string) {
    const [org, locations] = await Promise.all([
        q.query.organization.findFirst({ where: eq(organization.id, orgId), columns: { id: true, timezone: true, weekStartsOn: true } }),
        q.query.location.findMany({ where: eq(location.organizationId, orgId), columns: { id: true, name: true, timezone: true } }),
    ]);
    if (!org) throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
    const byId = new Map(locations.map((l) => [l.id, l]));
    const ctx: ConflictCtx = {
        locationById: byId,
        tzOf: (row) => row.timezone || (row.locationId ? byId.get(row.locationId)?.timezone : null) || org.timezone || "UTC",
        names: new Map(),
    };
    return { org, ctx };
}

/** Why putting this person on this shift needs "approve anyway". */
async function blockers(q: Q, orgId: string, row: LoadedShift, person: { id: string; name: string }, ctx: ConflictCtx) {
    ctx.names.set(`roster:${person.id}`, person.name);
    const found = await findBlockingConflicts(q as Tx, orgId, [{ shiftId: row.id, ref: { kind: "roster", personId: person.id } }], ctx);
    return found.flatMap((c) => c.messages);
}

/** "Ana would be at 44h this week": their paid hours in the shift's week, with it. */
async function hoursLine(q: Q, orgId: string, weekStartsOn: number, row: LoadedShift, person: { id: string; name: string }) {
    const tz = tzOf(row);
    const bounds = weekBounds(startOfLocalWeek(localDateInZone(row.startTime, tz), weekStartsOn), tz);
    const others = await q
        .select({ start: shift.startTime, end: shift.endTime, breakMinutes: shift.breakMinutes })
        .from(shiftAssignment)
        .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
        .where(
            and(
                eq(shift.organizationId, orgId),
                eq(shiftAssignment.workerId, person.id),
                notInArray(shiftAssignment.status, DEAD),
                sql`${shiftAssignment.pendingState} is distinct from 'remove'`,
                ne(shift.status, "cancelled"),
                ne(shift.id, row.id),
                gte(shift.startTime, bounds.start),
                lt(shift.startTime, bounds.end),
            ),
        );
    const paid = (s: { start: Date; end: Date; breakMinutes: number }) => Math.max(0, (s.end.getTime() - s.start.getTime()) / 60000 - s.breakMinutes);
    const total = others.reduce((sum, s) => sum + paid(s), paid({ start: row.startTime, end: row.endTime, breakMinutes: row.breakMinutes }));
    return `${person.name} would be at ${compactHours(total)} this week${total > WEEKLY_OVERTIME_MINUTES ? ", into overtime" : ""}`;
}

async function shiftsDuring(q: Q, orgId: string, workerId: string, start: Date, end: Date) {
    const rows = await findShifts(
        q,
        and(
            eq(shift.organizationId, orgId),
            ne(shift.status, "cancelled"),
            ne(shift.status, "draft"),
            lt(shift.startTime, end),
            gt(shift.endTime, start),
            inArray(
                shift.id,
                q
                    .select({ id: shiftAssignment.shiftId })
                    .from(shiftAssignment)
                    .where(and(eq(shiftAssignment.workerId, workerId), notInArray(shiftAssignment.status, DEAD))),
            ),
        ),
    );
    return rows.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

async function countPending(q: Q, orgId: string, now: Date) {
    const [[shifts], [off]] = await Promise.all([
        q.select({ n: count() }).from(shiftRequest).where(and(eq(shiftRequest.organizationId, orgId), eq(shiftRequest.status, "pending_manager"))),
        q
            .select({ n: count() })
            .from(timeOffRequest)
            .where(and(eq(timeOffRequest.organizationId, orgId), eq(timeOffRequest.status, "pending"), gt(timeOffRequest.endTime, now))),
    ]);
    return Number(shifts?.n ?? 0) + Number(off?.n ?? 0);
}

export async function getRequestsSummary(input: { orgId: string }): Promise<RequestsSummary> {
    const now = new Date();
    await expireStaleRequests(db, { orgId: input.orgId }, now);
    return { pending: await countPending(db, input.orgId, now) };
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

export async function listManagerRequests(input: { orgId: string; query: unknown }): Promise<ManagerRequestsResponse> {
    const { view } = parse(ManagerRequestsQuerySchema, input.query ?? {});
    const now = new Date();
    await expireStaleRequests(db, { orgId: input.orgId }, now);
    const since = new Date(now.getTime() - RECENT_DAYS * DAY_MS);
    const pendingView = view === "pending";

    const [{ org, ctx }, shiftRequests, timeOff, pendingCount] = await Promise.all([
        orgContext(db, input.orgId),
        db.query.shiftRequest.findMany({
            where: and(
                eq(shiftRequest.organizationId, input.orgId),
                pendingView
                    ? eq(shiftRequest.status, "pending_manager")
                    : and(notInArray(shiftRequest.status, [...PENDING_SHIFT_REQUEST]), gte(shiftRequest.updatedAt, since)),
            ),
            with: { requester: { columns: { id: true, name: true } }, target: { columns: { id: true, name: true } } },
            orderBy: desc(shiftRequest.createdAt),
            limit: 100,
        }),
        db.query.timeOffRequest.findMany({
            where: and(
                eq(timeOffRequest.organizationId, input.orgId),
                pendingView
                    ? and(eq(timeOffRequest.status, "pending"), gt(timeOffRequest.endTime, now))
                    : and(ne(timeOffRequest.status, "pending"), gte(timeOffRequest.updatedAt, since)),
            ),
            with: { worker: { columns: { id: true, name: true } } },
            orderBy: desc(timeOffRequest.createdAt),
            limit: 100,
        }),
        countPending(db, input.orgId, now),
    ]);

    const shiftIds = [...new Set(shiftRequests.map((r) => r.shiftId))];
    const deciderIds = [...new Set([...shiftRequests, ...timeOff].map((r) => r.decidedBy).filter((id): id is string => Boolean(id)))];
    const [shiftRows, deciders] = await Promise.all([
        shiftIds.length ? findShifts(db, inArray(shift.id, shiftIds)) : [],
        deciderIds.length ? db.query.user.findMany({ where: inArray(user.id, deciderIds), columns: { id: true, name: true } }) : [],
    ]);
    const shifts = new Map(shiftRows.map((s) => [s.id, s]));
    const deciderName = new Map(deciders.map((d) => [d.id, d.name]));
    const orgTz = org.timezone || "UTC";
    const weekStartsOn = org.weekStartsOn ?? 0;

    const fromShifts = await Promise.all(
        shiftRequests.map(async (r): Promise<ManagerRequest | null> => {
            const row = shifts.get(r.shiftId);
            if (!row) return null;
            const impact: string[] = [];
            const conflicts: string[] = [];
            if (pendingView) {
                if (r.type === "claim") {
                    const open = openSlotsOf(row);
                    if (open === 0) conflicts.push("No open spots left. Raise the headcount in the Scheduler first.");
                    else impact.push(`Takes 1 of ${open} open ${row.title} ${open === 1 ? "spot" : "spots"}`);
                    impact.push(await hoursLine(db, input.orgId, weekStartsOn, row, r.requester));
                    conflicts.push(...(await blockers(db, input.orgId, row, r.requester, ctx)));
                } else if (r.type === "drop") {
                    impact.push(`Opens 1 ${row.title} spot, ${whenLabel(row.startTime, row.endTime, tzOf(row))}`);
                } else if (r.target) {
                    impact.push(`${r.target.name} takes it and ${r.requester.name} comes off`);
                    impact.push(await hoursLine(db, input.orgId, weekStartsOn, row, r.target));
                    conflicts.push(...(await blockers(db, input.orgId, row, r.target, ctx)));
                }
            }
            return {
                id: r.id,
                kind: r.type as ManagerRequest["kind"],
                status: r.status as RequestStatus,
                createdAt: r.createdAt.toISOString(),
                requester: r.requester,
                target: r.target ? { id: r.target.id, name: r.target.name } : null,
                shift: requestShiftOf(row),
                timeOff: null,
                note: r.note,
                managerNote: null,
                impact,
                conflicts,
                decidedAt: r.decidedAt?.toISOString() ?? null,
                decidedByName: r.decidedBy ? deciderName.get(r.decidedBy) ?? null : null,
            };
        }),
    );

    const fromTimeOff = await Promise.all(
        timeOff.map(async (t): Promise<ManagerRequest> => {
            const impact: string[] = [];
            if (pendingView) {
                const during = await shiftsDuring(db, input.orgId, t.workerId, t.startTime, t.endTime);
                if (!during.length) impact.push("Nothing scheduled then");
                else {
                    const labels = during.slice(0, 3).map(shiftLabel);
                    impact.push(`On ${during.length} ${during.length === 1 ? "shift" : "shifts"} then: ${labels.join("; ")}${during.length > 3 ? "; …" : ""}`);
                    impact.push("Approving doesn't take them off; change those shifts in the Scheduler");
                }
            }
            return {
                id: t.id,
                kind: "time_off",
                status: t.status as RequestStatus,
                createdAt: t.createdAt.toISOString(),
                requester: t.worker,
                target: null,
                shift: null,
                timeOff: { startTime: t.startTime.toISOString(), endTime: t.endTime.toISOString(), allDay: t.allDay, timezone: orgTz },
                note: t.reason,
                managerNote: t.managerNote,
                impact,
                conflicts: [],
                decidedAt: t.decidedAt?.toISOString() ?? null,
                decidedByName: t.decidedBy ? deciderName.get(t.decidedBy) ?? null : null,
            };
        }),
    );

    const requests = [...fromShifts.filter((r): r is ManagerRequest => r !== null), ...fromTimeOff].sort((a, b) =>
        pendingView ? b.createdAt.localeCompare(a.createdAt) : (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt),
    );
    return { requests, pendingCount };
}

// ---------------------------------------------------------------------------
// Approve / decline
// ---------------------------------------------------------------------------

export async function decideRequest(input: {
    orgId: string;
    actorId: string;
    id: string;
    decision: "approve" | "decline";
    body: unknown;
}): Promise<DecideRequestResult> {
    const body = parse(DecideRequestInputSchema, input.body ?? {});
    const note = body.note?.trim() || null;
    const now = new Date();
    if (input.id.startsWith("tor_")) return decideTimeOff({ ...input, note, now });

    await expireStaleRequests(db, { orgId: input.orgId }, now);
    const request = await db.query.shiftRequest.findFirst({
        where: and(eq(shiftRequest.id, input.id), eq(shiftRequest.organizationId, input.orgId)),
        with: { requester: { columns: { id: true, name: true } }, target: { columns: { id: true, name: true } } },
    });
    if (!request) throw new AppError("Request not found", "REQUEST_NOT_FOUND", 404);
    if (request.status !== "pending_manager") {
        const why =
            request.status === "expired"
                ? "This request expired: the shift has started"
                : request.status === "pending_peer"
                  ? `Waiting on ${request.target?.name ?? "the coworker"} to accept first`
                  : "This request was already answered";
        throw new AppError(why, "REQUEST_NOT_PENDING", 409);
    }

    const row = await loadShift(db, request.shiftId);
    const label = shiftLabel(row);
    const why = note ? ` ${note}` : "";
    const requester = request.requester;
    const target = request.target;

    if (input.decision === "decline") {
        const messages: NotificationRow[] = [];
        const to = (workerId: string, title: string, text: string) =>
            messages.push(message({ workerId, orgId: input.orgId, title, body: text, now }));
        if (request.type === "claim") to(requester.id, "Open shift not approved", `${label}.${why}`);
        else if (request.type === "drop") to(requester.id, "Drop not approved", `You're still on ${label}.${why}`);
        else {
            to(requester.id, "Swap not approved", `You're still on ${label}.${why}`);
            if (target) to(target.id, "Swap not approved", `${requester.name} keeps ${label}.`);
        }
        await db.transaction(async (tx) => {
            await tx
                .update(shiftRequest)
                .set({ status: "declined", decidedBy: input.actorId, decidedAt: now, updatedAt: now })
                .where(eq(shiftRequest.id, request.id));
            await queue(tx, messages);
        });
        await logAudit({
            action: "request.declined",
            entityType: "shift_request",
            entityId: request.id,
            actorId: input.actorId,
            organizationId: input.orgId,
            metadata: { type: request.type, shiftId: row.id, note },
        });
        return { id: request.id, status: "declined" };
    }

    assertChangeable(row, now);
    const { ctx } = await orgContext(db, input.orgId);
    let overridden: string[] = [];

    await db.transaction(async (tx) => {
        await lockShift(tx, row.id);
        const fresh = await loadShift(tx, row.id);
        const messages: NotificationRow[] = [];
        const to = (workerId: string, title: string, text: string) =>
            messages.push(message({ workerId, orgId: input.orgId, title, body: text, now }));
        const place = fresh.location ? ` at ${fresh.location.name}` : "";

        if (request.type === "claim") {
            if (!liveAssignments(fresh).some((a) => a.workerId === requester.id)) {
                if (openSlotsOf(fresh) === 0) {
                    throw new AppError("This shift is full now. Raise the headcount in the Scheduler first, or decline.", "SHIFT_FULL", 409);
                }
                overridden = await blockers(tx, input.orgId, fresh, requester, ctx);
                if (overridden.length && !body.force) throw conflictError(requester.name, overridden);
                await putOnShift(tx, fresh, requester.id, now);
                await syncFullness(tx, fresh.id, now);
                await queue(tx, await remindersFor(tx, fresh, requester.id));
            }
            to(requester.id, "The shift is yours", `${label}${place}.${why}`);
        } else if (request.type === "drop") {
            if (isOnShift(fresh, requester.id)) {
                await takeOffShift(tx, fresh, requester.id, now);
                await syncFullness(tx, fresh.id, now);
            }
            to(requester.id, "You're off the shift", `${label}.${why}`);
        } else {
            if (!target) throw new AppError("This swap has no one to take the shift", "REQUEST_NOT_PENDING", 409);
            if (!isOnShift(fresh, requester.id)) {
                throw new AppError(`${requester.name} isn't on this shift anymore`, "REQUEST_NOT_PENDING", 409);
            }
            overridden = await blockers(tx, input.orgId, fresh, target, ctx);
            if (overridden.length && !body.force) throw conflictError(target.name, overridden);
            await applySwap(tx, { requestId: request.id, row: fresh, fromId: requester.id, toId: target.id, decidedBy: input.actorId, now });
            to(requester.id, "Swap approved", `${target.name} has your ${label} shift. You're off it.${why}`);
            to(target.id, "Swap approved: the shift is yours", `${label}${place}.${why}`);
        }

        await tx
            .update(shiftRequest)
            .set({ status: "approved", decidedBy: input.actorId, decidedAt: now, updatedAt: now })
            .where(eq(shiftRequest.id, request.id));
        await queue(tx, messages);
    });

    await logAudit({
        action: "request.approved",
        entityType: "shift_request",
        entityId: request.id,
        actorId: input.actorId,
        organizationId: input.orgId,
        metadata: { type: request.type, shiftId: row.id, note, overriddenConflicts: overridden },
    });
    if (overridden.length) {
        await logAudit({
            action: "schedule.conflict_override",
            entityType: "shift",
            entityId: row.id,
            actorId: input.actorId,
            organizationId: input.orgId,
            metadata: { requestId: request.id, messages: overridden },
        });
    }
    return { id: request.id, status: "approved" };
}

function conflictError(name: string, messages: string[]) {
    return new AppError(`${name}: ${messages[0]}`, "SCHEDULE_CONFLICT", 409, { conflicts: messages });
}

async function decideTimeOff(input: {
    orgId: string;
    actorId: string;
    id: string;
    decision: "approve" | "decline";
    note: string | null;
    now: Date;
}): Promise<DecideRequestResult> {
    const row = await db.query.timeOffRequest.findFirst({
        where: and(eq(timeOffRequest.id, input.id), eq(timeOffRequest.organizationId, input.orgId)),
        with: { organization: { columns: { timezone: true } } },
    });
    if (!row) throw new AppError("Request not found", "REQUEST_NOT_FOUND", 404);
    if (row.status !== "pending") throw new AppError("This request was already answered", "REQUEST_NOT_PENDING", 409);

    const status = input.decision === "approve" ? "approved" : "declined";
    const when = timeOffLabel(row.startTime, row.endTime, row.allDay, row.organization.timezone || "UTC");
    const why = input.note ? ` ${input.note}` : "";
    await db.transaction(async (tx) => {
        await tx
            .update(timeOffRequest)
            .set({ status, decidedBy: input.actorId, decidedAt: input.now, managerNote: input.note, updatedAt: input.now })
            .where(eq(timeOffRequest.id, row.id));
        await queue(tx, [
            message({
                workerId: row.workerId,
                orgId: input.orgId,
                title: status === "approved" ? "Time off approved" : "Time off not approved",
                body: `${when}.${why}`,
                now: input.now,
            }),
        ]);
    });
    await logAudit({
        action: `request.${status}`,
        entityType: "time_off_request",
        entityId: row.id,
        actorId: input.actorId,
        organizationId: input.orgId,
        metadata: { workerId: row.workerId, note: input.note },
    });
    return { id: row.id, status };
}
