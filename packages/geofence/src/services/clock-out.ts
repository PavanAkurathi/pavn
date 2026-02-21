// packages/geofence/src/services/clock-out.ts

import { db } from "@repo/database";
import { shiftAssignment, shift, workerLocation, location } from "@repo/database/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { logAudit } from "@repo/database";
import { applyClockOutRules, validateShiftTransition } from "@repo/config";
import { AppError } from "@repo/observability";

const ClockOutSchema = z.object({
    shiftId: z.string(),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    accuracyMeters: z.number().optional(),
    deviceTimestamp: z.string().datetime(),
});

export const clockOut = async (data: any, workerId: string, orgId: string) => {
    // 1. Validate input
    const parseResult = ClockOutSchema.safeParse(data);

    if (!parseResult.success) {
        throw new AppError("Invalid request", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const { shiftId, latitude, longitude, accuracyMeters, deviceTimestamp } = parseResult.data;

    // [SEC-005] Anti-Spoofing Checks
    const deviceTime = new Date(deviceTimestamp);
    const serverTime = new Date();
    const timeDiffMinutes = Math.abs(serverTime.getTime() - deviceTime.getTime()) / 60000;

    if (timeDiffMinutes > 5) {
        throw new AppError("Location data is stale or future-dated", "REPLAY_DETECTED", 400, {
            serverTime: serverTime.toISOString(),
            deviceTime: deviceTime.toISOString()
        });
    }

    if (accuracyMeters && accuracyMeters > 200) {
        throw new AppError("GPS signal too weak", "LOW_ACCURACY", 400, {
            accuracy: accuracyMeters,
            required: 200
        });
    }

    // 2. Fetch shift details
    const shiftRecord = await db.query.shift.findFirst({
        where: and(
            eq(shift.id, shiftId),
            eq(shift.organizationId, orgId)
        ),
        with: {
            location: true,
            assignments: {
                where: eq(shiftAssignment.workerId, workerId)
            }
        }
    });

    if (!shiftRecord) {
        throw new AppError("Shift not found", "NOT_FOUND", 404);
    }

    const assignment = shiftRecord.assignments[0];
    if (!assignment) {
        throw new AppError("You are not assigned to this shift", "FORBIDDEN", 403);
    }

    if (!assignment.actualClockIn) {
        throw new AppError("You must clock in first", "NOT_CLOCKED_IN", 400);
    }

    if (assignment.actualClockOut) {
        throw new AppError("Already clocked out", "ALREADY_CLOCKED_OUT", 400, {
            clockOutTime: assignment.actualClockOut
        });
    }

    // 3. Verify geofence using PostGIS
    const venueLocationId = shiftRecord.locationId;
    let isOnSite = true;
    let distanceMeters = 0;

    if (venueLocationId) {
        const point = `POINT(${longitude} ${latitude})`;
        const [geoResult] = await db.select({
            isWithin: sql<boolean>`ST_DWithin(${location.position}, ST_GeogFromText(${point}), ${location.geofenceRadius}::integer)`,
            distance: sql<number>`ST_Distance(${location.position}, ST_GeogFromText(${point}))`,
            radius: location.geofenceRadius
        })
            .from(location)
            .where(eq(location.id, venueLocationId));

        if (geoResult) {
            distanceMeters = Math.round(geoResult.distance || 0);
            isOnSite = !!geoResult.isWithin;
            const radius = geoResult.radius || 100;

            if (!isOnSite) {
                throw new AppError("You must be at the venue to clock out", "OUTSIDE_GEOFENCE", 400, {
                    distanceMeters,
                    requiredRadius: radius,
                    hint: "If you left early, ask your manager to adjust your timesheet"
                });
            }
        }
    }

    // 4. Apply time rules
    const now = new Date();
    const scheduledEnd = new Date(shiftRecord.endTime);
    const clockOutResult = applyClockOutRules(now, scheduledEnd);

    // 5. Transaction
    await db.transaction(async (tx) => {
        const point = `POINT(${longitude} ${latitude})`;

        // A. Update Assignment
        // Worker self clock-out: effective = actual (no snapping, record real departure time)
        const updatedArgs = await tx.update(shiftAssignment)
            .set({
                actualClockOut: clockOutResult.recordedTime,
                effectiveClockOut: clockOutResult.recordedTime,
                clockOutPosition: sql`ST_GeogFromText(${point})`,
                clockOutVerified: true,
                clockOutMethod: 'geofence',
                status: 'completed',
                updatedAt: now,
            })
            .where(and(
                eq(shiftAssignment.id, assignment.id),
                isNull(shiftAssignment.actualClockOut) // Guard
            ))
            .returning({ id: shiftAssignment.id });

        if (updatedArgs.length === 0) {
            throw new Error("Already clocked out (Race Condition)");
        }

        // B. Check if all assignments complete
        const allAssignments = await tx.query.shiftAssignment.findMany({
            where: eq(shiftAssignment.shiftId, shiftId)
        });

        const allComplete = allAssignments.every(a =>
            a.actualClockOut !== null || a.status === 'no_show'
        );

        if (allComplete) {
            try {
                validateShiftTransition(shiftRecord.status, 'completed');
                await tx.update(shift)
                    .set({ status: 'completed', updatedAt: now })
                    .where(eq(shift.id, shiftId));
            } catch (e) {
                console.warn("Invalid key transition ignored:", e);
            }
        }

        // C. Store Location
        await tx.insert(workerLocation).values({
            id: nanoid(),
            workerId,
            shiftId,
            organizationId: orgId,
            position: sql`ST_GeogFromText(${point})`,
            accuracyMeters: accuracyMeters || null,
            venuePosition: shiftRecord.locationId ? sql`(SELECT position FROM ${location} WHERE ${location.id} = ${shiftRecord.locationId})` : null,
            distanceToVenueMeters: distanceMeters,
            isOnSite: true,
            eventType: 'clock_out',
            recordedAt: now,
            deviceTimestamp: deviceTime
        });

        // Log Audit
        await logAudit({
            action: 'shift_assignment.clock_out',
            entityType: 'shift_assignment',
            entityId: assignment.id,
            actorId: workerId,
            organizationId: orgId,
            metadata: {
                latitude,
                longitude,
                method: 'geofence',
                distanceMeters
            }
        });
    });

    return {
        success: true,
        data: {
            clockOutTime: clockOutResult.recordedTime.toISOString(),
            actualTime: clockOutResult.actualTime.toISOString(),
            scheduledTime: clockOutResult.scheduledTime.toISOString(),
            wasEarly: clockOutResult.isEarly,
            wasLate: clockOutResult.isLate,
            minutesDifference: clockOutResult.minutesDifference,
        }
    };
};
