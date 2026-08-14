import { db } from "@repo/database";
import {
    shift,
    scheduledNotification,
    workerNotificationPreferences,
} from "@repo/database/schema";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@repo/observability";
import { buildNotificationSchedule } from "@repo/notifications";
import { notifyWorkersOfCrossOrgConflicts } from "../time-tracking/cross-org-conflict-notifications";

const MAX_DRAFTS_PER_CALL = 200;
const NOTIFICATION_CHUNK_SIZE = 100;

/** Taken from the consumer so the two cannot drift apart. */
type NotificationPreferences = NonNullable<Parameters<typeof buildNotificationSchedule>[6]>;

const PublishDraftsSchema = z.object({
    shiftIds: z
        .array(z.string())
        .min(1, "Nothing selected to publish")
        .max(MAX_DRAFTS_PER_CALL, `Cannot publish more than ${MAX_DRAFTS_PER_CALL} shifts at once`),
});

/**
 * Announce shifts that already exist as drafts.
 *
 * The `/publish` endpoint builds a schedule from scratch. This one takes drafts
 * that are already on the calendar — copied from last week, or saved half-done —
 * and turns them into real, visible shifts. It is the other half of Copy last
 * week: copying fills the grid, this tells the workers.
 *
 * A fully staffed shift becomes `assigned`; anything with an open slot becomes
 * `published` so it can still be picked up. Shifts that have already ended are
 * left alone — announcing them would only page people about work in the past.
 */
export const publishDrafts = async (body: unknown, orgId: string) => {
    const parsed = PublishDraftsSchema.safeParse(body);
    if (!parsed.success) {
        throw new AppError("Validation failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const requestedIds = Array.from(new Set(parsed.data.shiftIds));

    const drafts = await db.query.shift.findMany({
        where: and(
            eq(shift.organizationId, orgId),
            eq(shift.status, "draft"),
            inArray(shift.id, requestedIds),
        ),
        with: {
            location: { columns: { name: true } },
            assignments: true,
        },
    });

    if (drafts.length === 0) {
        throw new AppError("No draft shifts found to publish", "NOT_FOUND", 404);
    }

    const now = new Date();
    const publishable = drafts.filter((draft) => draft.endTime > now);
    const expiredCount = drafts.length - publishable.length;

    if (publishable.length === 0) {
        throw new AppError(
            "Those drafts have already ended. Move them to a future date before publishing.",
            "VALIDATION_ERROR",
            400,
        );
    }

    // A shift with every seat filled is `assigned`; one with an open slot stays
    // `published` so workers can still claim it. Mirrors the same call in
    // publishSchedule so both paths land on the same statuses.
    const statusFor = (draft: (typeof publishable)[number]) => {
        const activeAssignments = (draft.assignments ?? []).filter((a) => a.status !== "removed");
        const capacity = draft.capacityTotal ?? 0;
        return activeAssignments.length > 0 && activeAssignments.length >= capacity
            ? ("assigned" as const)
            : ("published" as const);
    };

    // Only app users can be notified: invited and agency workers have a null
    // workerId and no device to reach.
    const notifiable = publishable.flatMap((draft) =>
        (draft.assignments ?? [])
            .filter((assignment) => assignment.status !== "removed" && assignment.workerId)
            .map((assignment) => ({
                workerId: assignment.workerId as string,
                shiftId: draft.id,
                startTime: draft.startTime,
                endTime: draft.endTime,
                title: draft.title,
                venueName: draft.location?.name || "the venue",
            })),
    );

    const preferencesMap = new Map<string, NotificationPreferences>();
    const workerIds = Array.from(new Set(notifiable.map((n) => n.workerId)));

    if (workerIds.length > 0) {
        const prefs = await db.query.workerNotificationPreferences.findMany({
            where: inArray(workerNotificationPreferences.workerId, workerIds),
        });

        for (const p of prefs) {
            preferencesMap.set(p.workerId, {
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

    const notificationsToInsert: (typeof scheduledNotification.$inferInsert)[] = [];
    for (const entry of notifiable) {
        const schedule = await buildNotificationSchedule(
            entry.workerId,
            entry.shiftId,
            orgId,
            entry.startTime,
            entry.title,
            entry.venueName,
            preferencesMap.get(entry.workerId),
        );
        notificationsToInsert.push(...schedule);
    }

    await db.transaction(async (tx) => {
        for (const draft of publishable) {
            await tx
                .update(shift)
                .set({ status: statusFor(draft) })
                .where(
                    and(
                        eq(shift.id, draft.id),
                        eq(shift.organizationId, orgId),
                        // Re-checked inside the transaction so a shift published
                        // by someone else in the meantime is not announced twice.
                        eq(shift.status, "draft"),
                    ),
                );
        }

        for (let i = 0; i < notificationsToInsert.length; i += NOTIFICATION_CHUNK_SIZE) {
            await tx
                .insert(scheduledNotification)
                .values(notificationsToInsert.slice(i, i + NOTIFICATION_CHUNK_SIZE));
        }
    });

    if (notifiable.length > 0) {
        await notifyWorkersOfCrossOrgConflicts(
            notifiable.map(({ workerId, shiftId, startTime, endTime }) => ({
                workerId,
                shiftId,
                startTime,
                endTime,
            })),
            orgId,
        );
    }

    return {
        success: true,
        published: publishable.length,
        notified: workerIds.length,
        expired: expiredCount,
    };
};
