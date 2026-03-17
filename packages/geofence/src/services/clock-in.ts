// packages/geofence/src/services/clock-in.ts

import { db, jsonPositionToGeography, toLatLng } from "@repo/database";
import { shift, shiftAssignment, workerLocation, organization, location } from "@repo/database/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
    applyClockInRules,
    validateShiftTransition,
    DEFAULT_ATTENDANCE_VERIFICATION_POLICY,
} from "@repo/config";
import { cancelNotificationByType } from "@repo/notifications";
import { notifyManagers } from "../utils/manager-notifications"; // Ensure this util exists or is moved
import { logAudit } from "@repo/database";
import { AppError } from "@repo/observability";

const ClockInSchema = z.object({
    shiftId: z.string(),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    accuracyMeters: z.number().optional(),
    deviceTimestamp: z.string().datetime(),
});

export const clockIn = async (data: any, workerId: string, orgId: string) => {
    // 1. Validate input
    const parseResult = ClockInSchema.safeParse(data);

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
                where: eq(shiftAssignment.workerId, workerId),
                with: { worker: true }
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

    if (assignment.actualClockIn) {
        throw new AppError("Already clocked in", "ALREADY_CLOCKED_IN", 400, {
            clockInTime: assignment.actualClockIn
        });
    }

    // 3. Resolve org policy and time buffer
    const orgConfig = await db.query.organization.findFirst({
        where: eq(organization.id, orgId),
        columns: {
            earlyClockInBufferMinutes: true,
            attendanceVerificationPolicy: true,
        }
    });

    const attendanceVerificationPolicy =
        orgConfig?.attendanceVerificationPolicy || DEFAULT_ATTENDANCE_VERIFICATION_POLICY;

    let distanceMeters = 0;
    let radius = shiftRecord.location?.geofenceRadius || 100;
    let isWithinGeofence = attendanceVerificationPolicy === "none";
    let locationAvailable = false;

    if (attendanceVerificationPolicy !== "none") {
        if (!shiftRecord.locationId) {
            if (attendanceVerificationPolicy === "strict_geofence") {
                throw new AppError("Venue location not configured", "VENUE_NOT_GEOCODED", 400);
            }
        } else {
            const point = `POINT(${longitude} ${latitude})`;
            const [geoResult] = await db.select({
                isWithin: sql<boolean>`ST_DWithin(${jsonPositionToGeography(location.position)}, ST_GeogFromText(${point}), ${location.geofenceRadius}::integer)`,
                distance: sql<number>`ST_Distance(${jsonPositionToGeography(location.position)}, ST_GeogFromText(${point}))`,
                radius: location.geofenceRadius
            })
                .from(location)
                .where(eq(location.id, shiftRecord.locationId));

            if (!geoResult) {
                if (attendanceVerificationPolicy === "strict_geofence") {
                    throw new AppError("Venue location not found", "VENUE_NOT_FOUND", 404);
                }
            } else {
                locationAvailable = true;
                distanceMeters = Math.round(geoResult.distance || 0);
                radius = geoResult.radius || 100;
                isWithinGeofence = !!geoResult.isWithin;
            }
        }
    }

    if (attendanceVerificationPolicy === "strict_geofence" && !isWithinGeofence) {
        throw new AppError("You must be at the venue to clock in", "OUTSIDE_GEOFENCE", 400, {
            distanceMeters,
            requiredRadius: radius
        });
    }

    // 4. Time Validation
    const now = new Date();
    const scheduledStart = new Date(shiftRecord.startTime);
    const EARLY_BUFFER_MINUTES = orgConfig?.earlyClockInBufferMinutes || 60;
    const earliestClockIn = new Date(scheduledStart.getTime() - EARLY_BUFFER_MINUTES * 60 * 1000);

    if (now < earliestClockIn) {
        throw new AppError(`Cannot clock in more than ${EARLY_BUFFER_MINUTES} minutes before shift`, "TOO_EARLY", 400, {
            shiftStart: scheduledStart.toISOString(),
            earliestClockIn: earliestClockIn.toISOString()
        });
    }

    const clockInResult = applyClockInRules(now, scheduledStart);

    // 5. Transaction
    const effectiveStart = now < scheduledStart ? scheduledStart : now;
    const shouldFlagClockIn =
        attendanceVerificationPolicy === "soft_geofence" &&
        (!locationAvailable || !isWithinGeofence);
    const clockInMethod =
        attendanceVerificationPolicy === "strict_geofence"
            ? "geofence"
            : attendanceVerificationPolicy === "soft_geofence"
              ? (isWithinGeofence ? "geofence" : "soft_geofence")
              : "policy_none";
    const reviewReason =
        assignment.reviewReason ?? (shouldFlagClockIn ? "geofence_mismatch" : null);

    await db.transaction(async (tx) => {
        // A. Update Assignment
        // Worker self clock-in: effectiveClockIn snaps to scheduled start (never earlier)
        // If worker is late, effective = actual (they don't get credit for time they weren't here)
        await tx.update(shiftAssignment)
            .set({
                actualClockIn: clockInResult.recordedTime,
                effectiveClockIn: effectiveStart,
                clockInPosition: toLatLng(latitude, longitude),
                clockInVerified: attendanceVerificationPolicy === "strict_geofence" || isWithinGeofence,
                clockInMethod,
                needsReview: assignment.needsReview || shouldFlagClockIn,
                reviewReason,
                lastKnownPosition: shouldFlagClockIn ? toLatLng(latitude, longitude) : assignment.lastKnownPosition,
                lastKnownAt: shouldFlagClockIn ? now : assignment.lastKnownAt,
                updatedAt: now,
            })
            .where(eq(shiftAssignment.id, assignment.id));

        // B. Update Shift Status (if needed)
        if (shiftRecord.status === 'assigned') {
            validateShiftTransition(shiftRecord.status, 'in-progress');
            await tx.update(shift)
                .set({ status: 'in-progress', updatedAt: now })
                .where(eq(shift.id, shiftId));
        }

        // C. Store Location Record
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
            eventType: 'clock_in',
            recordedAt: now,
            deviceTimestamp: deviceTime,
        });

        // D. Log Audit
        await logAudit({
            action: 'shift_assignment.clock_in',
            entityType: 'shift_assignment',
            entityId: assignment.id,
            actorId: workerId,
            organizationId: orgId,
            metadata: {
                latitude,
                longitude,
                method: 'geofence',
                distanceMeters,
                scheduledStart: scheduledStart.toISOString(),
                actualClockIn: clockInResult.recordedTime.toISOString(),
                effectiveClockIn: effectiveStart.toISOString(),
                wasEarly: clockInResult.isEarly,
                wasLate: clockInResult.isLate,
                minutesDifference: clockInResult.minutesDifference,
            }
        });
    });

    // 6. Cleanup Notifications (Async)
    try {
        await Promise.all([
            cancelNotificationByType(shiftId, workerId, 'shift_start'),
            cancelNotificationByType(shiftId, workerId, 'late_warning'),
            cancelNotificationByType(shiftId, workerId, '15_min')
        ]);
    } catch (cleanupError) {
        console.error("[CLOCK_IN] Failed to cancel notifications:", cleanupError);
    }

    // 7. Notify Managers (Async)
    notifyManagers('clock-in', shiftRecord, assignment.worker?.name || "Unknown Worker").catch(err => {
        console.error("[CLOCK_IN] Failed to notify managers:", err);
    });

    return {
        success: true,
        data: {
            clockInTime: clockInResult.recordedTime.toISOString(),
            effectiveClockIn: effectiveStart.toISOString(),
            actualTime: clockInResult.actualTime.toISOString(),
            scheduledTime: clockInResult.scheduledTime.toISOString(),
            wasEarly: clockInResult.isEarly,
            wasLate: clockInResult.isLate,
            minutesDifference: clockInResult.minutesDifference,
        }
    };
};
