// packages/scheduling-timekeeping/src/modules/requests/worker.ts

/**
 * The worker's side of requests, across every workplace they belong to:
 * open shifts to pick up, dropping or handing off a shift, answering a
 * coworker's swap, and time off.
 *
 * Every call checks membership against the shift's own organization, so
 * these routes need no organization header.
 */

import { db, logAudit } from "@repo/database";
import { shift, shiftRequest, timeOffRequest, worker } from "@repo/database/schema";
import { AppError } from "@repo/observability";
import {
    TimeOffInputSchema,
    WorkerRequestActionSchema,
    WorkerShiftRequestInputSchema,
    type OpenShiftsResponse,
    type RequestStatus,
    type SwapCandidatesResponse,
    type TimeOffCreated,
    type WorkerRequest,
    type WorkerRequestResult,
    type WorkerRequestsResponse,
} from "@repo/contracts/requests";
import { and, desc, eq, gt, gte, inArray, lt, ne, or } from "drizzle-orm";

import { newId } from "../../utils/ids";
import { addDaysToLocalDate, combineDateTimeTz } from "../../utils/zoned-time";
import {
    LIVE_SHIFT,
    PENDING_SHIFT_REQUEST,
    accountOf,
    applySwap,
    assertChangeable,
    busyWindows,
    canWork,
    clash,
    expireStaleRequests,
    findCoworker,
    findShifts,
    hasAccountOn,
    isOnShift,
    liveAssignments,
    loadShift,
    lockShift,
    membershipsOf,
    message,
    openSlotsOf,
    parse,
    putOnShift,
    queue,
    remindersFor,
    requestShiftOf,
    requireMember,
    rolesOf,
    shiftLabel,
    syncFullness,
    type LoadedShift,
} from "./shared";

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far ahead the Open tab looks. */
const OPEN_SHIFT_DAYS = 28;
/** How long decided requests stay in the worker's list. */
const HISTORY_DAYS = 45;

const isPending = (status: string) => (PENDING_SHIFT_REQUEST as readonly string[]).includes(status);

// ---------------------------------------------------------------------------
// Open shifts
// ---------------------------------------------------------------------------

export async function listOpenShifts(input: { workerId: string }): Promise<OpenShiftsResponse> {
    const now = new Date();
    const memberships = await membershipsOf(db, input.workerId);
    if (!memberships.length) return { shifts: [] };

    const until = new Date(now.getTime() + OPEN_SHIFT_DAYS * DAY_MS);
    const [rows, roleMaps, busy, claims] = await Promise.all([
        findShifts(
            db,
            and(
                inArray(shift.organizationId, memberships.map((m) => m.organizationId)),
                inArray(shift.status, [...LIVE_SHIFT]),
                gt(shift.startTime, now),
                lt(shift.startTime, until),
            ),
        ),
        Promise.all(memberships.map((m) => rolesOf(db, m.organizationId, [{ id: input.workerId, jobTitle: m.jobTitle }]))),
        busyWindows(db, [input.workerId], now, new Date(until.getTime() + DAY_MS)),
        db.query.shiftRequest.findMany({
            where: and(
                eq(shiftRequest.requesterWorkerId, input.workerId),
                eq(shiftRequest.type, "claim"),
                inArray(shiftRequest.status, [...PENDING_SHIFT_REQUEST]),
            ),
            columns: { id: true, shiftId: true },
        }),
    ]);
    const rolesByOrg = new Map(memberships.map((m, i) => [m.organizationId, roleMaps[i]!.get(input.workerId) ?? []]));
    const claimed = new Map(claims.map((c) => [c.shiftId, c.id]));
    const mine = busy.get(input.workerId);

    const shifts = rows
        .filter(
            (row) =>
                !row.pendingPatch?.cancel &&
                openSlotsOf(row) > 0 &&
                !hasAccountOn(row, input.workerId) &&
                canWork(rolesByOrg.get(row.organizationId) ?? [], row.title),
        )
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
        .map((row) => {
            const hit = clash(mine, row);
            return {
                shift: requestShiftOf(row),
                organization: { id: row.organization.id, name: row.organization.name },
                openSlots: openSlotsOf(row),
                breakMinutes: row.breakMinutes,
                note: row.description ?? null,
                claimPolicy: row.organization.openShiftClaimPolicy === "auto" ? ("auto" as const) : ("approval" as const),
                conflict: hit ? `You're ${hit.label}` : null,
                pendingRequestId: claimed.get(row.id) ?? null,
            };
        });
    return { shifts };
}

// ---------------------------------------------------------------------------
// Claim, drop, swap
// ---------------------------------------------------------------------------

export async function createShiftRequest(input: { workerId: string; body: unknown }): Promise<WorkerRequestResult> {
    const body = parse(WorkerShiftRequestInputSchema, input.body);
    const now = new Date();
    const row = await loadShift(db, body.shiftId);
    const me = await requireMember(db, row.organizationId, input.workerId);
    assertChangeable(row, now);

    const existing = await db.query.shiftRequest.findFirst({
        where: and(
            eq(shiftRequest.shiftId, row.id),
            eq(shiftRequest.requesterWorkerId, input.workerId),
            eq(shiftRequest.type, body.type),
            inArray(shiftRequest.status, [...PENDING_SHIFT_REQUEST]),
        ),
    });
    if (existing) {
        if (body.type === "swap") {
            throw new AppError("You already offered this shift to someone. Cancel that offer first.", "REQUEST_EXISTS", 409);
        }
        return { id: existing.id, status: existing.status as RequestStatus, message: "You already asked. Your manager hasn't answered yet." };
    }

    if (body.type === "claim") return claim(row, input.workerId, me.jobTitle, body.note, now);

    if (!isOnShift(row, input.workerId)) throw new AppError("You're not on this shift", "NOT_ON_SHIFT", 409);

    if (body.type === "drop") {
        const id = newId("req");
        await db.insert(shiftRequest).values({
            id,
            organizationId: row.organizationId,
            type: "drop",
            shiftId: row.id,
            requesterWorkerId: input.workerId,
            status: "pending_manager",
            note: body.note || null,
        });
        return { id, status: "pending_manager", message: "Sent to your manager. You're still on it until they say yes." };
    }

    // Swap: offer the shift to a named coworker, who accepts first.
    if (body.targetWorkerId === input.workerId) throw new AppError("Pick a coworker", "VALIDATION_ERROR", 400);
    const target = await findCoworker(db, row.organizationId, body.targetWorkerId);
    const targetName = target.user.name;
    const roles = (await rolesOf(db, row.organizationId, [{ id: target.user.id, jobTitle: target.jobTitle }])).get(target.user.id) ?? [];
    if (!canWork(roles, row.title)) throw new AppError(`${targetName} isn't set up to work ${row.title}`, "ROLE_MISMATCH", 409);
    if (hasAccountOn(row, target.user.id)) {
        throw new AppError(`${targetName} is already on this shift`, "ALREADY_ON_SHIFT", 409);
    }
    const busy = await busyWindows(db, [target.user.id], row.startTime, row.endTime);
    if (clash(busy.get(target.user.id), row)) throw new AppError(`${targetName} isn't free then`, "SCHEDULE_CONFLICT", 409);

    const id = newId("req");
    await db.transaction(async (tx) => {
        await tx.insert(shiftRequest).values({
            id,
            organizationId: row.organizationId,
            type: "swap",
            shiftId: row.id,
            requesterWorkerId: input.workerId,
            targetWorkerId: target.user.id,
            status: "pending_peer",
            note: body.note || null,
        });
        await queue(tx, [
            message({
                workerId: target.user.id,
                orgId: row.organizationId,
                type: "swap_offer",
                title: `${me.user.name} asked you to take a shift`,
                body: `${shiftLabel(row)}${row.location ? ` at ${row.location.name}` : ""}. Open Requests to accept or decline.`,
                now,
            }),
        ]);
    });
    const next = row.organization.swapApprovalRequired ? "your manager approves it next" : "it's theirs";
    return { id, status: "pending_peer", message: `Sent to ${targetName}. If they accept, ${next}.` };
}

async function claim(row: LoadedShift, workerId: string, jobTitle: string | null, note: string | undefined, now: Date): Promise<WorkerRequestResult> {
    if (hasAccountOn(row, workerId)) throw new AppError("You're already on this shift", "ALREADY_ON_SHIFT", 409);
    const roles = (await rolesOf(db, row.organizationId, [{ id: workerId, jobTitle }])).get(workerId) ?? [];
    if (!canWork(roles, row.title)) {
        throw new AppError(`This shift is for ${row.title}. Ask your manager to add it to your roles.`, "ROLE_MISMATCH", 403);
    }
    if (openSlotsOf(row) === 0) throw new AppError("Someone got there first. This shift is full.", "SHIFT_FULL", 409);
    const hit = clash((await busyWindows(db, [workerId], row.startTime, row.endTime)).get(workerId), row);
    if (hit) throw new AppError(`You're ${hit.label}`, "SCHEDULE_CONFLICT", 409);

    const id = newId("req");
    const base = { id, organizationId: row.organizationId, type: "claim", shiftId: row.id, requesterWorkerId: workerId, note: note || null };
    if (row.organization.openShiftClaimPolicy !== "auto") {
        await db.insert(shiftRequest).values({ ...base, status: "pending_manager" });
        return { id, status: "pending_manager", message: "Sent to your manager. You'll get a notification when they answer." };
    }

    // First to claim gets it: lock the shift so two people can't take the last spot.
    await db.transaction(async (tx) => {
        await lockShift(tx, row.id);
        const fresh = await loadShift(tx, row.id);
        if (hasAccountOn(fresh, workerId)) throw new AppError("You're already on this shift", "ALREADY_ON_SHIFT", 409);
        if (openSlotsOf(fresh) === 0) throw new AppError("Someone got there first. This shift is full.", "SHIFT_FULL", 409);
        await tx.insert(shiftRequest).values({ ...base, status: "approved", decidedAt: now });
        await putOnShift(tx, fresh, workerId, now);
        await syncFullness(tx, fresh.id, now);
        await queue(tx, await remindersFor(tx, fresh, workerId));
    });
    await logAudit({
        action: "shift.claimed",
        entityType: "shift",
        entityId: row.id,
        actorId: workerId,
        organizationId: row.organizationId,
        metadata: { requestId: id },
    });
    return { id, status: "approved", message: `You're on it: ${shiftLabel(row)}.` };
}

// ---------------------------------------------------------------------------
// My requests
// ---------------------------------------------------------------------------

export async function listWorkerRequests(input: { workerId: string }): Promise<WorkerRequestsResponse> {
    const now = new Date();
    await expireStaleRequests(db, { workerId: input.workerId }, now);
    const since = new Date(now.getTime() - HISTORY_DAYS * DAY_MS);

    const [shiftRequests, timeOff] = await Promise.all([
        db.query.shiftRequest.findMany({
            where: and(
                or(
                    eq(shiftRequest.requesterWorkerId, input.workerId),
                    and(eq(shiftRequest.targetWorkerId, input.workerId), eq(shiftRequest.type, "swap")),
                ),
                or(inArray(shiftRequest.status, [...PENDING_SHIFT_REQUEST]), gte(shiftRequest.createdAt, since)),
            ),
            with: {
                requester: { columns: { id: true, name: true } },
                target: { columns: { id: true, name: true } },
                organization: { columns: { id: true, name: true } },
            },
            orderBy: desc(shiftRequest.createdAt),
            limit: 100,
        }),
        db.query.timeOffRequest.findMany({
            where: and(eq(timeOffRequest.workerId, input.workerId), or(gt(timeOffRequest.endTime, now), gte(timeOffRequest.createdAt, since))),
            with: { organization: { columns: { id: true, name: true, timezone: true } } },
            orderBy: desc(timeOffRequest.createdAt),
            limit: 100,
        }),
    ]);

    const shiftIds = [...new Set(shiftRequests.map((r) => r.shiftId))];
    const shifts = new Map((shiftIds.length ? await findShifts(db, inArray(shift.id, shiftIds)) : []).map((s) => [s.id, s]));

    const requests: WorkerRequest[] = [
        ...shiftRequests.map((r) => {
            const sent = r.requesterWorkerId === input.workerId;
            const other = sent ? r.target : r.requester;
            const row = shifts.get(r.shiftId);
            return {
                id: r.id,
                kind: r.type as WorkerRequest["kind"],
                status: r.status as RequestStatus,
                direction: sent ? ("sent" as const) : ("received" as const),
                organization: r.organization,
                shift: row ? requestShiftOf(row) : null,
                timeOff: null,
                otherPerson: r.type === "swap" && other ? { id: other.id, name: other.name } : null,
                note: r.note,
                managerNote: null,
                createdAt: r.createdAt.toISOString(),
                decidedAt: r.decidedAt?.toISOString() ?? null,
                canCancel: sent && isPending(r.status),
                canRespond: !sent && r.status === "pending_peer",
            };
        }),
        ...timeOff.map((t) => ({
            id: t.id,
            kind: "time_off" as const,
            status: t.status as RequestStatus,
            direction: "sent" as const,
            organization: { id: t.organization.id, name: t.organization.name },
            shift: null,
            timeOff: {
                startTime: t.startTime.toISOString(),
                endTime: t.endTime.toISOString(),
                allDay: t.allDay,
                timezone: t.organization.timezone || "UTC",
            },
            otherPerson: null,
            note: t.reason,
            managerNote: t.managerNote,
            createdAt: t.createdAt.toISOString(),
            decidedAt: t.decidedAt?.toISOString() ?? null,
            canCancel: (t.status === "pending" || t.status === "approved") && t.startTime > now,
            canRespond: false,
        })),
    ].sort((a, b) => Number(b.canRespond) - Number(a.canRespond) || b.createdAt.localeCompare(a.createdAt));

    return { requests };
}

export async function actOnRequest(input: { workerId: string; id: string; action: unknown }): Promise<WorkerRequestResult> {
    const action = parse(WorkerRequestActionSchema, input.action);
    const now = new Date();

    if (input.id.startsWith("tor_")) {
        if (action !== "cancel") throw new AppError("Time off can only be cancelled", "VALIDATION_ERROR", 400);
        const row = await db.query.timeOffRequest.findFirst({
            where: and(eq(timeOffRequest.id, input.id), eq(timeOffRequest.workerId, input.workerId)),
        });
        if (!row) throw new AppError("Request not found", "REQUEST_NOT_FOUND", 404);
        if (!(row.status === "pending" || row.status === "approved") || row.startTime <= now) {
            throw new AppError("This time off can't be cancelled anymore", "REQUEST_NOT_PENDING", 409);
        }
        await db.update(timeOffRequest).set({ status: "cancelled", updatedAt: now }).where(eq(timeOffRequest.id, row.id));
        return { id: row.id, status: "cancelled", message: "Cancelled." };
    }

    await expireStaleRequests(db, { workerId: input.workerId }, now);
    const request = await db.query.shiftRequest.findFirst({
        where: eq(shiftRequest.id, input.id),
        with: { requester: { columns: { id: true, name: true } }, target: { columns: { id: true, name: true } } },
    });
    if (!request || (request.requesterWorkerId !== input.workerId && request.targetWorkerId !== input.workerId)) {
        throw new AppError("Request not found", "REQUEST_NOT_FOUND", 404);
    }
    if (!isPending(request.status)) {
        throw new AppError(
            request.status === "expired" ? "This request expired: the shift has started" : "This request was already answered",
            "REQUEST_NOT_PENDING",
            409,
        );
    }
    const row = await loadShift(db, request.shiftId);

    if (action === "cancel") {
        if (request.requesterWorkerId !== input.workerId) throw new AppError("Only the person who asked can cancel", "FORBIDDEN", 403);
        await db.transaction(async (tx) => {
            await tx.update(shiftRequest).set({ status: "cancelled", updatedAt: now }).where(eq(shiftRequest.id, request.id));
            if (request.type === "swap" && request.target) {
                await queue(tx, [
                    message({
                        workerId: request.target.id,
                        orgId: request.organizationId,
                        title: `${request.requester.name} took back their swap`,
                        body: `${shiftLabel(row)}. Nothing for you to do.`,
                        now,
                    }),
                ]);
            }
        });
        return { id: request.id, status: "cancelled", message: "Cancelled." };
    }

    // Accept or decline a swap a coworker offered you.
    if (request.type !== "swap" || request.targetWorkerId !== input.workerId || request.status !== "pending_peer") {
        throw new AppError("There's nothing to answer here", "REQUEST_NOT_PENDING", 409);
    }
    const me = request.target!;

    if (action === "decline") {
        await db.transaction(async (tx) => {
            await tx.update(shiftRequest).set({ status: "declined", decidedAt: now, updatedAt: now }).where(eq(shiftRequest.id, request.id));
            await queue(tx, [
                message({
                    workerId: request.requesterWorkerId,
                    orgId: request.organizationId,
                    title: `${me.name} can't take your shift`,
                    body: `${shiftLabel(row)}. You're still on it.`,
                    now,
                }),
            ]);
        });
        return { id: request.id, status: "declined", message: "Declined." };
    }

    assertChangeable(row, now);
    if (!isOnShift(row, request.requesterWorkerId)) {
        await db.update(shiftRequest).set({ status: "expired", updatedAt: now }).where(eq(shiftRequest.id, request.id));
        throw new AppError(`${request.requester.name} isn't on this shift anymore`, "REQUEST_NOT_PENDING", 409);
    }
    const hit = clash((await busyWindows(db, [me.id], row.startTime, row.endTime)).get(me.id), row);
    if (hit) throw new AppError(`You're ${hit.label}`, "SCHEDULE_CONFLICT", 409);

    if (row.organization.swapApprovalRequired) {
        await db.transaction(async (tx) => {
            await tx.update(shiftRequest).set({ status: "pending_manager", updatedAt: now }).where(eq(shiftRequest.id, request.id));
            await queue(tx, [
                message({
                    workerId: request.requesterWorkerId,
                    orgId: request.organizationId,
                    title: `${me.name} accepted your swap`,
                    body: `${shiftLabel(row)}. Your manager approves it next; you're on it until then.`,
                    now,
                }),
            ]);
        });
        return { id: request.id, status: "pending_manager", message: "Accepted. Your manager approves it next." };
    }

    await db.transaction(async (tx) => {
        await lockShift(tx, row.id);
        const fresh = await loadShift(tx, row.id);
        await applySwap(tx, { requestId: request.id, row: fresh, fromId: request.requesterWorkerId, toId: me.id, decidedBy: null, now });
        await queue(tx, [
            message({
                workerId: request.requesterWorkerId,
                orgId: request.organizationId,
                title: "Swap done",
                body: `${me.name} has your ${shiftLabel(row)} shift. You're off it.`,
                now,
            }),
        ]);
    });
    await logAudit({
        action: "shift.swapped",
        entityType: "shift",
        entityId: row.id,
        actorId: me.id,
        organizationId: request.organizationId,
        metadata: { requestId: request.id, from: request.requesterWorkerId, to: me.id },
    });
    return { id: request.id, status: "approved", message: `It's yours: ${shiftLabel(row)}.` };
}

// ---------------------------------------------------------------------------
// Swap candidates
// ---------------------------------------------------------------------------

export async function listSwapCandidates(input: { workerId: string; shiftId: string }): Promise<SwapCandidatesResponse> {
    const row = await loadShift(db, input.shiftId);
    await requireMember(db, row.organizationId, input.workerId);
    if (!isOnShift(row, input.workerId)) throw new AppError("You're not on this shift", "NOT_ON_SHIFT", 409);

    const coworkerRows = await db.query.worker.findMany({
        where: and(
            eq(worker.organizationId, row.organizationId),
            eq(worker.status, "active"),
            ne(worker.userId, input.workerId),
        ),
        columns: { userId: true, name: true, jobTitle: true },
    });
    // Only people who have signed in can be offered a shift by their coworkers.
    const coworkers = coworkerRows.flatMap((c) => (c.userId ? [{ jobTitle: c.jobTitle, user: { id: c.userId, name: c.name } }] : []));
    const roles = await rolesOf(db, row.organizationId, coworkers.map((c) => ({ id: c.user.id, jobTitle: c.jobTitle })));
    const onIt = new Set(liveAssignments(row).map(accountOf));
    const eligible = coworkers.filter((c) => !onIt.has(c.user.id) && canWork(roles.get(c.user.id) ?? [], row.title));
    const busy = await busyWindows(db, eligible.map((c) => c.user.id), row.startTime, row.endTime);

    const people = eligible
        // Someone else's schedule stays private: just whether they're free.
        .map((c) => ({ id: c.user.id, name: c.user.name, conflict: clash(busy.get(c.user.id), row) ? "Not free then" : null }))
        .sort((a, b) => Number(a.conflict !== null) - Number(b.conflict !== null) || a.name.localeCompare(b.name));
    return { people };
}

// ---------------------------------------------------------------------------
// Time off
// ---------------------------------------------------------------------------

export async function createTimeOff(input: { workerId: string; body: unknown }): Promise<TimeOffCreated> {
    const body = parse(TimeOffInputSchema, input.body);
    const now = new Date();
    const memberships = await membershipsOf(db, input.workerId);
    const chosen = body.organizationIds ? memberships.filter((m) => body.organizationIds!.includes(m.organizationId)) : memberships;
    if (!chosen.length) throw new AppError("Pick a workplace", "NO_WORKPLACE", 400);

    const rows = chosen.map((m) => {
        const tz = m.organization.timezone || "UTC";
        return {
            id: newId("tor"),
            organizationId: m.organizationId,
            workerId: input.workerId,
            startTime: body.allDay ? combineDateTimeTz(body.startDate!, "00:00", tz) : new Date(body.startTime!),
            endTime: body.allDay ? combineDateTimeTz(addDaysToLocalDate(body.endDate!, 1), "00:00", tz) : new Date(body.endTime!),
            allDay: body.allDay,
            reason: body.reason || null,
            status: "pending",
        };
    });
    if (rows.some((r) => r.endTime <= now)) throw new AppError("That time has already passed", "VALIDATION_ERROR", 400);

    const earliest = new Date(Math.min(...rows.map((r) => r.startTime.getTime())));
    const latest = new Date(Math.max(...rows.map((r) => r.endTime.getTime())));
    const existing = await db.query.timeOffRequest.findMany({
        where: and(
            eq(timeOffRequest.workerId, input.workerId),
            inArray(timeOffRequest.status, ["pending", "approved"]),
            inArray(timeOffRequest.organizationId, rows.map((r) => r.organizationId)),
            lt(timeOffRequest.startTime, latest),
            gt(timeOffRequest.endTime, earliest),
        ),
    });
    if (rows.some((r) => existing.some((e) => e.organizationId === r.organizationId && e.startTime < r.endTime && e.endTime > r.startTime))) {
        throw new AppError("You already asked for time off then", "TIME_OFF_EXISTS", 409);
    }

    await db.insert(timeOffRequest).values(rows);
    return {
        ids: rows.map((r) => r.id),
        message: rows.length === 1 ? "Sent to your manager." : `Sent to your managers at ${rows.length} workplaces.`,
    };
}
