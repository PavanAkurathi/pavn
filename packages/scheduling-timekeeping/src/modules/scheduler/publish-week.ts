// packages/scheduling-timekeeping/src/modules/scheduler/publish-week.ts

/**
 * Publishing a week at one location: everything the manager staged becomes
 * what staff see, and each affected person gets one message about their own
 * changes (not one per shift, and nothing for people whose week didn't move).
 *
 * The preview and the publish share one plan, so the dialog shows exactly
 * what the button will do.
 */

import { db, logAudit } from "@repo/database";
import {
    location,
    organization,
    scheduledNotification,
    shift,
    shiftAssignment,
    worker,
    workerNotificationPreferences,
    type ShiftPendingPatch,
} from "@repo/database/schema";
import { AppError } from "@repo/observability";
import { buildNotificationSchedule } from "@repo/notifications";
import {
    SchedulerPublishInputSchema,
    SchedulerWeekScopeSchema,
    type SchedulerBlockingConflict,
    type SchedulerPersonRef,
    type SchedulerPublishPerson,
    type SchedulerPublishPreview,
    type SchedulerPublishResult,
} from "@repo/contracts/scheduler";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { ZodType } from "zod";

import { startOfLocalWeek, weekBounds, weekDates } from "../../domain/week";
import { workerKind } from "../../utils/mapper";
import { notifyWorkersOfCrossOrgConflicts } from "../time-tracking/cross-org-conflict-notifications";
import {
    DEAD_ASSIGNMENT,
    EDITABLE,
    findBlockingConflicts,
    refOf,
    workingCopy,
    type AssignmentRow,
    type ShiftRow,
    type Tx,
} from "./changes";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Staff-visible fields; a change to any of these is worth telling the people on the shift. */
const NEWSWORTHY: (keyof ShiftPendingPatch)[] = ["startTime", "endTime", "title", "description", "breakMinutes"];

type NotificationPreferences = NonNullable<Parameters<typeof buildNotificationSchedule>[6]>;

function parse<T>(schema: ZodType<T>, input: unknown): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        throw new AppError(parsed.error.issues[0]?.message ?? "Validation failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }
    return parsed.data;
}

const keyOf = (ref: SchedulerPersonRef) => ref.personId;

function weekLabel(dates: string[]) {
    const [, m1, d1] = dates[0]!.split("-").map(Number) as [number, number, number];
    const [, m2, d2] = dates[6]!.split("-").map(Number) as [number, number, number];
    return m1 === m2 ? `${MONTHS[m1 - 1]} ${d1} – ${d2}` : `${MONTHS[m1 - 1]} ${d1} – ${MONTHS[m2 - 1]} ${d2}`;
}

type Row = ShiftRow & { locationName: string };
type Kind = "new" | "changed" | "removed";

interface Plan {
    orgId: string;
    locationName: string;
    label: string;
    items: { row: Row; kind: Kind; newsworthy: boolean }[];
    effects: Map<string, SchedulerPublishPerson>;
    staying: { shiftId: string; ref: SchedulerPersonRef }[];
    /** Worker id -> the app account their notifications go to (none until they sign in). */
    accountOf: Map<string, string>;
    preview: SchedulerPublishPreview;
}

async function planPublish(q: Tx | typeof db, orgId: string, body: unknown, now: Date): Promise<Plan> {
    const scope = parse(SchedulerWeekScopeSchema, body);
    const [org, locations] = await Promise.all([
        q.query.organization.findFirst({ where: eq(organization.id, orgId), columns: { timezone: true, weekStartsOn: true } }),
        q.query.location.findMany({ where: eq(location.organizationId, orgId), columns: { id: true, name: true, timezone: true } }),
    ]);
    if (!org) throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
    const loc = locations.find((l) => l.id === scope.locationId);
    if (!loc) throw new AppError("Location not found", "LOCATION_NOT_FOUND", 404);
    const tz = loc.timezone || org.timezone;
    const weekStart = startOfLocalWeek(scope.weekStart, org.weekStartsOn ?? 0);
    const bounds = weekBounds(weekStart, tz);

    const rows = (
        await q.query.shift.findMany({
            where: and(
                eq(shift.organizationId, orgId),
                eq(shift.locationId, loc.id),
                lt(shift.startTime, new Date(bounds.end.getTime() + 7 * DAY_MS)),
                gt(shift.endTime, new Date(bounds.start.getTime() - 7 * DAY_MS)),
                inArray(shift.status, [...EDITABLE]),
            ),
            with: {
                assignments: {
                    columns: { id: true, workerId: true, status: true, pendingState: true },
                },
            },
        })
    ).map((r) => ({ ...(r as unknown as ShiftRow), locationName: loc.name }));

    const items: Plan["items"] = [];
    const effects = new Map<string, SchedulerPublishPerson>();
    const staying: Plan["staying"] = [];
    let expiredDrafts = 0;
    let openSlots = 0;

    const touch = (a: AssignmentRow, what: "added" | "changed" | "removed") => {
        const ref = refOf(a);
        // Kind and name are filled in once the workers are loaded, below.
        const entry = effects.get(keyOf(ref)) ?? { personId: ref.personId, kind: "invited" as const, name: "", added: 0, changed: 0, removed: 0 };
        entry[what]++;
        effects.set(keyOf(ref), entry);
    };

    for (const row of rows) {
        const ws = workingCopy(row);
        if (ws.start < bounds.start || ws.start >= bounds.end) continue;
        const live = row.assignments.filter((a) => !DEAD_ASSIGNMENT.has(a.status));
        const stayingHere = live.filter((a) => a.pendingState !== "remove");

        if (row.status === "draft") {
            if (ws.end <= now) {
                expiredDrafts++;
                continue;
            }
            items.push({ row, kind: "new", newsworthy: true });
            live.forEach((a) => touch(a, "added"));
        } else if (ws.cancel) {
            items.push({ row, kind: "removed", newsworthy: true });
            live.filter((a) => a.pendingState !== "add").forEach((a) => touch(a, "removed"));
            continue;
        } else {
            const patch = row.pendingPatch ?? {};
            const newsworthy = NEWSWORTHY.some((k) => patch[k] !== undefined);
            const changed = Object.keys(patch).length > 0 || live.some((a) => a.pendingState);
            if (changed) {
                items.push({ row, kind: "changed", newsworthy });
                for (const a of live) {
                    if (a.pendingState === "add") touch(a, "added");
                    else if (a.pendingState === "remove") touch(a, "removed");
                    else if (newsworthy) touch(a, "changed");
                }
            }
        }

        openSlots += Math.max(0, ws.capacity - stayingHere.length);
        if (items[items.length - 1]?.row === row) {
            for (const a of stayingHere) {
                staying.push({ shiftId: row.id, ref: refOf(a) });
            }
        }
    }

    // Names and kinds for the dialog.
    const accountOf = new Map<string, string>();
    const names = new Map<string, string>();
    if (effects.size) {
        const people = await q.query.worker.findMany({
            where: and(eq(worker.organizationId, orgId), inArray(worker.id, [...effects.keys()])),
            columns: { id: true, name: true, userId: true, employmentType: true },
        });
        for (const person of people) {
            const entry = effects.get(person.id);
            if (!entry) continue;
            entry.kind = workerKind(person);
            entry.name = person.name;
            names.set(person.id, person.name);
            if (person.userId) accountOf.set(person.id, person.userId);
        }
    }
    for (const entry of effects.values()) entry.name ||= "Someone";

    const conflicts = await findBlockingConflicts(q as Tx, orgId, staying, {
        locationById: new Map(locations.map((l) => [l.id, l])),
        tzOf: (row) => row.timezone || (row.locationId ? locations.find((l) => l.id === row.locationId)?.timezone : null) || org.timezone,
        names: new Map([...names]),
    });

    const people = [...effects.values()].sort((a, b) => a.name.localeCompare(b.name));
    return {
        orgId,
        locationName: loc.name,
        label: weekLabel(weekDates(weekStart)),
        items,
        effects,
        staying,
        accountOf,
        preview: {
            newShifts: items.filter((i) => i.kind === "new").length,
            changedShifts: items.filter((i) => i.kind === "changed").length,
            removedShifts: items.filter((i) => i.kind === "removed").length,
            notify: people.filter((p) => p.kind === "active"),
            unreachable: people.filter((p) => p.kind !== "active"),
            openSlots,
            conflicts,
            expiredDrafts,
        },
    };
}

export async function previewSchedulerPublish(input: { orgId: string; body: unknown }): Promise<SchedulerPublishPreview> {
    return (await planPublish(db, input.orgId, input.body, new Date())).preview;
}

function summaryOf(person: SchedulerPublishPerson) {
    const parts = [
        person.added ? `${person.added} new ${person.added === 1 ? "shift" : "shifts"}` : null,
        person.changed ? `${person.changed} changed` : null,
        person.removed ? `${person.removed} removed` : null,
    ].filter(Boolean);
    return parts.join(", ");
}

export async function publishSchedulerWeek(input: { orgId: string; actorId: string; body: unknown }): Promise<SchedulerPublishResult> {
    const { force, ...scope } = parse(SchedulerPublishInputSchema, input.body);
    const now = new Date();
    const first = await planPublish(db, input.orgId, scope, now);
    if (first.preview.conflicts.length && !force) {
        throw new AppError(
            `${first.preview.conflicts.length} ${first.preview.conflicts.length === 1 ? "person is" : "people are"} double-booked or on time off`,
            "SCHEDULE_CONFLICT",
            409,
            { conflicts: first.preview.conflicts },
        );
    }

    // Reminders for everyone staying on a new or changed shift, built before the
    // transaction because preferences are read one worker at a time.
    const workerIds = [...new Set(first.staying.flatMap((s) => first.accountOf.get(s.ref.personId) ?? []))];
    const prefs = new Map<string, NotificationPreferences>();
    if (workerIds.length) {
        for (const p of await db.query.workerNotificationPreferences.findMany({ where: inArray(workerNotificationPreferences.workerId, workerIds) })) {
            prefs.set(p.workerId, {
                nightBeforeEnabled: p.nightBeforeEnabled ?? true,
                sixtyMinEnabled: p.sixtyMinEnabled ?? true,
                fifteenMinEnabled: p.fifteenMinEnabled ?? true,
                shiftStartEnabled: p.shiftStartEnabled ?? true,
                lateWarningEnabled: p.lateWarningEnabled ?? true,
                quietHoursEnabled: p.quietHoursEnabled ?? false,
                quietHoursStart: p.quietHoursStart,
                quietHoursEnd: p.quietHoursEnd,
            });
        }
    }

    let result: SchedulerPublishPreview = first.preview;
    const announced: { workerId: string; shiftId: string; startTime: Date; endTime: Date }[] = [];

    await db.transaction(async (tx) => {
        // Re-plan inside the transaction so a change made since the preview is not lost.
        const plan = await planPublish(tx, input.orgId, scope, now);
        result = plan.preview;
        const reminders: (typeof scheduledNotification.$inferInsert)[] = [];

        for (const { row, kind, newsworthy } of plan.items) {
            const ws = workingCopy(row);
            const live = row.assignments.filter((a) => !DEAD_ASSIGNMENT.has(a.status));

            if (kind === "removed") {
                await tx.update(shift).set({ status: "cancelled", pendingPatch: null, publishedAt: now, updatedAt: now }).where(eq(shift.id, row.id));
                await tx.update(shiftAssignment).set({ status: "cancelled", pendingState: null, updatedAt: now }).where(eq(shiftAssignment.shiftId, row.id));
                await tx
                    .update(scheduledNotification)
                    .set({ status: "cancelled", updatedAt: now })
                    .where(and(eq(scheduledNotification.shiftId, row.id), eq(scheduledNotification.status, "pending")));
                continue;
            }

            const stays = live.filter((a) => a.pendingState !== "remove");
            const leaving = live.filter((a) => a.pendingState === "remove");
            const full = stays.length > 0 && stays.length >= ws.capacity;
            await tx
                .update(shift)
                .set({
                    startTime: ws.start,
                    endTime: ws.end,
                    title: ws.role,
                    capacityTotal: ws.capacity,
                    breakMinutes: ws.breakMinutes,
                    description: ws.note,
                    eventId: ws.eventId,
                    pendingPatch: null,
                    status: full ? "assigned" : "published",
                    publishedAt: now,
                    updatedAt: now,
                })
                .where(eq(shift.id, row.id));

            for (const a of leaving) {
                await tx.update(shiftAssignment).set({ status: "removed", pendingState: null, updatedAt: now }).where(eq(shiftAssignment.id, a.id));
                const account = plan.accountOf.get(a.workerId);
                if (account) {
                    await tx
                        .update(scheduledNotification)
                        .set({ status: "cancelled", updatedAt: now })
                        .where(
                            and(
                                eq(scheduledNotification.shiftId, row.id),
                                eq(scheduledNotification.workerId, account),
                                eq(scheduledNotification.status, "pending"),
                            ),
                        );
                }
            }
            const joining = kind === "new" ? stays : stays.filter((a) => a.pendingState === "add");
            if (stays.some((a) => a.pendingState)) {
                await tx
                    .update(shiftAssignment)
                    .set({ pendingState: null, updatedAt: now })
                    .where(and(eq(shiftAssignment.shiftId, row.id), eq(shiftAssignment.pendingState, "add")));
            }

            // Everyone's reminders are rebuilt when the time moved; otherwise only
            // the people joining get theirs.
            const timesMoved = kind === "changed" && newsworthy;
            if (timesMoved) {
                await tx
                    .delete(scheduledNotification)
                    .where(and(eq(scheduledNotification.shiftId, row.id), eq(scheduledNotification.status, "pending")));
            }
            for (const a of timesMoved ? stays : joining) {
                const account = plan.accountOf.get(a.workerId);
                if (!account || ws.end <= now) continue;
                const schedule = await buildNotificationSchedule(account, row.id, input.orgId, ws.start, ws.role, row.locationName, prefs.get(account));
                // The one message per person below replaces the per-shift "new shift" push.
                reminders.push(...schedule.filter((n) => n.type !== "assignment_created"));
            }
            for (const a of joining) {
                const account = plan.accountOf.get(a.workerId);
                if (account) announced.push({ workerId: account, shiftId: row.id, startTime: ws.start, endTime: ws.end });
            }
        }

        // One message per person, about their own week.
        for (const person of plan.preview.notify) {
            const summary = summaryOf(person);
            const account = plan.accountOf.get(person.personId);
            if (!summary || !account) continue;
            reminders.push({
                id: nanoid(),
                workerId: account,
                shiftId: null,
                organizationId: input.orgId,
                type: "schedule_published",
                title: person.added && !person.changed && !person.removed ? "You're on the schedule" : "Your schedule changed",
                body: `${plan.locationName}, ${plan.label}: ${summary}. Open the app to see your shifts.`,
                data: { type: "schedule_published", url: "/(tabs)" },
                scheduledAt: now,
                status: "pending",
            });
        }
        for (let i = 0; i < reminders.length; i += 100) {
            await tx.insert(scheduledNotification).values(reminders.slice(i, i + 100));
        }
    });

    await logAudit({
        action: "schedule.published",
        entityType: "location",
        entityId: scope.locationId,
        actorId: input.actorId,
        organizationId: input.orgId,
        metadata: {
            weekStart: scope.weekStart,
            newShifts: result.newShifts,
            changedShifts: result.changedShifts,
            removedShifts: result.removedShifts,
            notified: result.notify.length,
            overriddenConflicts: result.conflicts as SchedulerBlockingConflict[],
        },
    });

    if (announced.length) await notifyWorkersOfCrossOrgConflicts(announced, input.orgId);

    return { ...result, publishedAt: now.toISOString() };
}
