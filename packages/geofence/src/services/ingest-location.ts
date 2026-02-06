// packages/geofence/src/services/ingest-location.ts

import { db } from "@repo/database";
import { workerLocation, shiftAssignment, shift, member, location } from "@repo/database/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { sendSMS } from "@repo/auth";
import { AppError } from "@repo/observability";

const LocationPingSchema = z.object({
    latitude: z.string(),
    longitude: z.string(),
    accuracyMeters: z.number().optional(),
    deviceTimestamp: z.string().optional(),
});

export const ingestLocation = async (data: any, workerId: string, orgId: string) => {
    // 1. Validate
    const parseResult = LocationPingSchema.safeParse(data);
    if (!parseResult.success) {
        throw new AppError("Invalid location data", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const { latitude, longitude, accuracyMeters, deviceTimestamp } = parseResult.data;

    // 2. Verify worker
    const membership = await db.query.member.findFirst({
        where: and(
            eq(member.userId, workerId),
            eq(member.organizationId, orgId)
        ),
        with: { user: true }
    });

    if (!membership) {
        throw new AppError("Worker not in organization", "FORBIDDEN", 403);
    }

    // 3. Find shift
    const now = new Date();
    const activeAssignment = await db.query.shiftAssignment.findFirst({
        where: and(
            eq(shiftAssignment.workerId, workerId),
            inArray(shiftAssignment.status, ['active'])
        ),
        with: {
            shift: {
                with: { location: true }
            }
        }
    });

    let relevantShift = null;
    let relevantAssignment = null;
    let venueLocationId = null;
    let venueName = null;

    if (activeAssignment?.shift) {
        const shiftStart = new Date(activeAssignment.shift.startTime);
        const shiftEnd = new Date(activeAssignment.shift.endTime);
        const bufferMs = 60 * 60 * 1000;

        if (now.getTime() >= shiftStart.getTime() - bufferMs && now.getTime() <= shiftEnd.getTime() + bufferMs) {
            relevantShift = activeAssignment.shift;
            relevantAssignment = activeAssignment;
            venueLocationId = activeAssignment.shift.locationId;
            venueName = activeAssignment.shift.location?.name;
        } else {
            return { success: true, message: "Ignored: Outside 60m shift window" };
        }
    } else {
        return { success: true, message: "Ignored: No active shift" };
    }

    // 4. Calculate distance
    let distanceMeters: number | null = null;
    let isOnSite = false;
    let eventType = 'ping';
    const point = `POINT(${longitude} ${latitude})`;

    if (venueLocationId) {
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
        }
    }

    // Previous Ping
    const previousPing = relevantShift ? await db.query.workerLocation.findFirst({
        where: and(
            eq(workerLocation.workerId, workerId),
            eq(workerLocation.shiftId, relevantShift.id)
        ),
        orderBy: [desc(workerLocation.recordedAt)]
    }) : null;

    // Throttling
    if (isOnSite && relevantAssignment && relevantAssignment.actualClockIn && !relevantAssignment.actualClockOut) {
        if (previousPing && (now.getTime() - previousPing.recordedAt.getTime()) < 10 * 60 * 1000) {
            return {
                success: true,
                throttled: true,
                data: {
                    isOnSite,
                    distanceMeters,
                    eventType: 'ping_throttled',
                    shiftId: relevantShift?.id || null,
                    canClockIn: false,
                    canClockOut: true,
                }
            };
        }
    }

    // 5. Detect Arrival
    if (isOnSite && relevantAssignment && !relevantAssignment.actualClockIn) {
        if (!previousPing || !previousPing.isOnSite) {
            eventType = 'arrival';
            // Send SMS
            if (membership.user.phoneNumber) {
                const message = `Hi ${membership.user.name}, you have arrived at ${venueName}. Please remember to clock in using the app.`;
                sendSMS(membership.user.phoneNumber, message).catch(err => console.error("SMS failed", err));
            }
        }
    }

    // 6. Detect Departure
    if (!isOnSite && relevantAssignment?.actualClockIn && !relevantAssignment.actualClockOut) {
        if (previousPing?.isOnSite) {
            if (relevantAssignment.reviewReason !== 'left_geofence') {
                eventType = 'departure';
                await db.update(shiftAssignment)
                    .set({
                        needsReview: true,
                        reviewReason: 'left_geofence',
                        lastKnownPosition: sql`ST_GeogFromText(${point})`,
                        lastKnownAt: now,
                        updatedAt: now,
                    })
                    .where(eq(shiftAssignment.id, relevantAssignment.id));

                if (membership.user.phoneNumber) {
                    const message = `Hi ${membership.user.name}, we detected you left the venue. You have been flagged for review. Please clock out or contact your manager.`;
                    sendSMS(membership.user.phoneNumber, message).catch(err => console.error("SMS failed", err));
                }
            }
        }
    }

    // 7. Store Record
    await db.insert(workerLocation).values({
        id: nanoid(),
        workerId,
        shiftId: relevantShift?.id || null,
        organizationId: orgId,
        position: sql`ST_GeogFromText(${point})`,
        accuracyMeters: accuracyMeters || null,
        venuePosition: venueLocationId ? sql`(SELECT position FROM ${location} WHERE ${location.id} = ${venueLocationId})` : null,
        distanceToVenueMeters: distanceMeters,
        isOnSite,
        eventType,
        recordedAt: now,
        deviceTimestamp: deviceTimestamp ? new Date(deviceTimestamp) : null,
    });

    return {
        success: true,
        data: {
            isOnSite,
            distanceMeters,
            eventType,
            shiftId: relevantShift?.id || null,
            canClockIn: isOnSite && relevantAssignment && !relevantAssignment.actualClockIn,
            canClockOut: isOnSite && relevantAssignment?.actualClockIn && !relevantAssignment.actualClockOut,
        }
    };
};
