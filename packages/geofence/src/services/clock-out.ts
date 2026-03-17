// packages/geofence/src/services/clock-out.ts

import { db, jsonPositionToGeography, toLatLng } from "@repo/database";
import { shiftAssignment, shift, workerLocation, location, organization } from "@repo/database/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { logAudit } from "@repo/database";
import {
    applyClockOutRules,
    validateShiftTransition,
    DEFAULT_ATTENDANCE_VERIFICATION_POLICY,
} from "@repo/config";
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

    // 3. Resolve org policy and verify geofence
    const orgConfig = await db.query.organization.findFirst({
        where: eq(organization.id, orgId),
        columns: { attendanceVerificationPolicy: true }
    });
    const attendanceVerificationPolicy =
        orgConfig?.attendanceVerificationPolicy || DEFAULT_ATTENDANCE_VERIFICATION_POLICY;

    const venueLocationId = shiftRecord.locationId;
    let isOnSite = attendanceVerificationPolicy === "none";
    let distanceMeters = 0;
    let locationAvailable = false;

    if (attendanceVerificationPolicy !== "none" && venueLocationId) {
        const point = `POINT(${longitude} ${latitude})`;
        const [geoResult] = await db.select({
            isWithin: sql<boolean>`ST_DWithin(${jsonPositionToGeography(location.position)}, ST_GeogFromText(${point}), ${location.geofenceRadius}::integer)`,
            distance: sql<number>`ST_Distance(${jsonPositionToGeography(location.position)}, ST_GeogFromText(${point}))`,
            radius: location.geofenceRadius
        })
            .from(location)
            .where(eq(location.id, venueLocationId));

        if (geoResult) {
            locationAvailable = true;
            distanceMeters = Math.round(geoResult.distance || 0);
            isOnSite = !!geoResult.isWithin;
            const radius = geoResult.radius || 100;

            if (attendanceVerificationPolicy === "strict_geofence" && !isOnSite) {
                throw new AppError("You must be at the venue to clock out", "OUTSIDE_GEOFENCE", 400, {
                    distanceMeters,
                    requiredRadius: radius,
                    hint: "If you left early, ask your manager to adjust your timesheet"
                });
            }
        } else if (attendanceVerificationPolicy === "strict_geofence") {
            throw new AppError("Venue location not found", "VENUE_NOT_FOUND", 404);
        }
    } else if (attendanceVerificationPolicy === "strict_geofence") {
        throw new AppError("Venue location not configured", "VENUE_NOT_GEOCODED", 400);
    }

    // 4. Apply time rules
    const now = new Date();
    const scheduledEnd = new Date(shiftRecord.endTime);
    const clockOutResult = applyClockOutRules(now, scheduledEnd);
    const shouldFlagClockOut =
        attendanceVerificationPolicy === "soft_geofence" &&
        (!locationAvailable || !isOnSite);
    const clockOutMethod =
        attendanceVerificationPolicy === "strict_geofence"
            ? "geofence"
            : attendanceVerificationPolicy === "soft_geofence"
              ? (isOnSite ? "geofence" : "soft_geofence")
              : "policy_none";

    // 5. Transaction
    await db.transaction(async (tx) => {
        // A. Update Assignment
        // Worker self clock-out: effective = actual (no snapping, record real departure time)
        const updatedArgs = await tx.update(shiftAssignment)
            .set({
                actualClockOut: clockOutResult.recordedTime,
                effectiveClockOut: clockOutResult.recordedTime,
                clockOutPosition: toLatLng(latitude, longitude),
                clockOutVerified: attendanceVerificationPolicy === "strict_geofence" || isOnSite,
                clockOutMethod,
                needsReview: assignment.needsReview || shouldFlagClockOut,
                reviewReason: assignment.reviewReason ?? (shouldFlagClockOut ? "geofence_mismatch" : null),
                lastKnownPosition: shouldFlagClockOut ? toLatLng(latitude, longitude) : assignment.lastKnownPosition,
                lastKnownAt: shouldFlagClockOut ? now : assignment.lastKnownAt,
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
            position: toLatLng(latitude, longitude),
            accuracyMeters: accuracyMeters || null,
            venuePosition: shiftRecord.location?.position ?? null,
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
