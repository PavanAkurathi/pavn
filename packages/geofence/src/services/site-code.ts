import { db } from "@repo/database";
import { shift, shiftAssignment, rateLimitState } from "@repo/database/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { randomInt } from "crypto";
import { z } from "zod";
import { logAudit } from "@repo/database";
import { AppError } from "@repo/observability";

const CODE_LENGTH = 4;
/**
 * Four digits is ten thousand guesses, which a script gets through in minutes.
 * The limit is what makes the short code safe to say out loud, so it is not
 * optional: a handful of tries per worker per shift, then nothing.
 */
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/** Statuses where clocking in is a coherent thing to want. */
const CLOCKABLE_STATUSES = ["published", "assigned", "in-progress"];

const ClockInWithCodeSchema = z.object({
    shiftId: z.string(),
    code: z.string().regex(/^\d{4}$/, "The code is four digits"),
});

function newCode() {
    // randomInt, not Math.random — this is a credential, however short-lived.
    return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/**
 * The code a supervisor reads out at the gate.
 *
 * Issued on demand and kept, so asking twice during one shift gives the same
 * four digits rather than silently invalidating the ones already written on
 * someone's hand.
 */
export const getSiteCode = async (shiftId: string, orgId: string, managerId: string) => {
    const existing = await db.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
        columns: { id: true, status: true, siteCode: true, siteCodeIssuedAt: true },
    });

    if (!existing) {
        throw new AppError("Shift not found", "NOT_FOUND", 404);
    }

    if (!CLOCKABLE_STATUSES.includes(existing.status)) {
        throw new AppError(
            `Nobody can clock in to a ${existing.status} shift, so it has no code.`,
            "INVALID_STATE",
            409,
        );
    }

    if (existing.siteCode) {
        return { code: existing.siteCode, issuedAt: existing.siteCodeIssuedAt, reused: true };
    }

    const code = newCode();
    const issuedAt = new Date();

    await db
        .update(shift)
        .set({ siteCode: code, siteCodeIssuedAt: issuedAt })
        .where(eq(shift.id, shiftId));

    await logAudit({
        action: "shift.site_code_issued",
        entityType: "shift",
        entityId: shiftId,
        actorId: managerId,
        organizationId: orgId,
        metadata: { issuedAt: issuedAt.toISOString() },
    });

    return { code, issuedAt, reused: false };
};

/**
 * Clock in with the code instead of the geofence.
 *
 * Deliberately not a way around the geofence so much as a way through it when
 * it is wrong: the time is recorded exactly as normal, but marked unverified
 * and flagged for review, so the manager sees every use.
 */
export const clockInWithSiteCode = async (data: unknown, workerId: string, orgId: string) => {
    const parsed = ClockInWithCodeSchema.safeParse(data);
    if (!parsed.success) {
        throw new AppError("Invalid request", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const { shiftId, code } = parsed.data;

    const targetShift = await db.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
        columns: { id: true, status: true, siteCode: true, startTime: true, title: true },
    });

    if (!targetShift) {
        throw new AppError("Shift not found", "NOT_FOUND", 404);
    }

    if (!CLOCKABLE_STATUSES.includes(targetShift.status)) {
        throw new AppError(`Cannot clock in to a ${targetShift.status} shift`, "INVALID_STATE", 409);
    }

    const assignment = await db.query.shiftAssignment.findFirst({
        where: and(
            eq(shiftAssignment.shiftId, shiftId),
            or(eq(shiftAssignment.workerId, workerId), eq(shiftAssignment.rosterEntryId, workerId)),
        ),
    });

    if (!assignment) {
        throw new AppError("You are not on this shift", "FORBIDDEN", 403);
    }

    if (assignment.actualClockIn) {
        throw new AppError("You are already clocked in", "INVALID_STATE", 409);
    }

    // Counted before the comparison, so a wrong guess costs an attempt whether
    // or not a code has been issued at all.
    await consumeAttempt(shiftId, workerId);

    if (!targetShift.siteCode || targetShift.siteCode !== code) {
        throw new AppError(
            "That code does not match. Ask your supervisor to read it again.",
            "INVALID_SITE_CODE",
            403,
        );
    }

    const now = new Date();
    // Same rule as a normal clock-in: turning up early does not start the clock
    // early. The code changes how you are verified, not what you are paid for.
    const effectiveClockIn = now < targetShift.startTime ? targetShift.startTime : now;

    await db.transaction(async (tx) => {
        await tx
            .update(shiftAssignment)
            .set({
                actualClockIn: now,
                effectiveClockIn,
                clockInMethod: "site_code",
                clockInVerified: false,
                needsReview: true,
                reviewReason: "Clocked in with a site code — location was not verified",
                status: "active",
                updatedAt: now,
            })
            .where(eq(shiftAssignment.id, assignment.id));

        await logAudit({
            action: "shift_assignment.site_code_clock_in",
            entityType: "shift_assignment",
            entityId: assignment.id,
            actorId: workerId,
            organizationId: orgId,
            metadata: {
                shiftId,
                actualClockIn: now.toISOString(),
                effectiveClockIn: effectiveClockIn.toISOString(),
            },
        });
    });

    return {
        success: true,
        clockInTime: effectiveClockIn.toISOString(),
        verified: false,
        message: "Clocked in. Your manager will see this was done with a site code.",
    };
};

/** One shared counter per worker per shift, so guessing cannot be parallelised away. */
async function consumeAttempt(shiftId: string, workerId: string) {
    const key = `site_code:${shiftId}:${workerId}`;
    const now = Date.now();

    const state = await db.query.rateLimitState.findFirst({
        where: eq(rateLimitState.key, key),
    });

    const windowStart = state ? Number(state.windowStart) : 0;
    const inWindow = state !== undefined && now - windowStart < ATTEMPT_WINDOW_MS;

    if (inWindow && state!.count >= MAX_ATTEMPTS) {
        throw new AppError(
            "Too many tries. Wait fifteen minutes, or ask your supervisor to clock you in.",
            "RATE_LIMITED",
            429,
        );
    }

    if (inWindow) {
        await db
            .update(rateLimitState)
            .set({ count: sql`${rateLimitState.count} + 1`, updatedAt: new Date() })
            .where(eq(rateLimitState.key, key));
        return;
    }

    await db
        .insert(rateLimitState)
        .values({ key, count: 1, windowStart: String(now), updatedAt: new Date() })
        .onConflictDoUpdate({
            target: rateLimitState.key,
            set: { count: 1, windowStart: String(now), updatedAt: new Date() },
        });
}
