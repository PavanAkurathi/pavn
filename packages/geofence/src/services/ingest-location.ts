// packages/geofence/src/services/ingest-location.ts

import { db } from "@repo/database";
import { workerLocation, shiftAssignment, shift, member, location } from "@repo/database/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { sendPushNotification } from "@repo/notifications";
import { AppError } from "@repo/observability";

const LocationPingSchema = z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
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
    const activeAssignments = await db.select({
        assignment: shiftAssignment,
        shift,
        location,
    })
        .from(shiftAssignment)
        .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
        .leftJoin(location, eq(shift.locationId, location.id))
        .where(and(
            eq(shiftAssignment.workerId, workerId),
            eq(shift.organizationId, orgId),
            inArray(shiftAssignment.status, ['active', 'assigned', 'in-progress'])
        ))
        .orderBy(desc(shift.startTime));

    let relevantShift = null;
    let relevantAssignment = null;
    let venueLocationId = null;
    let venueName = null;

    if (activeAssignments.length > 0) {
        const bufferMs = 60 * 60 * 1000;
        const activeAssignment = activeAssignments.find(({ shift }) => {
            const shiftStart = new Date(shift.startTime);
            const shiftEnd = new Date(shift.endTime);
            return now.getTime() >= shiftStart.getTime() - bufferMs && now.getTime() <= shiftEnd.getTime() + bufferMs;
        });

        if (activeAssignment) {
            relevantShift = activeAssignment.shift;
            relevantAssignment = activeAssignment.assignment;
            venueLocationId = activeAssignment.shift.locationId;
            venueName = activeAssignment.location?.name;
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
            isWithin: sql<boolean>`ST_DWithin(${location.position}::geography, ST_GeogFromText(${point}), ${location.geofenceRadius}::integer)`,
            distance: sql<number>`ST_Distance(${location.position}::geography, ST_GeogFromText(${point}))`,
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
            sendPushNotification({
                workerId,
                title: "You've arrived",
                body: `You are at ${venueName || "your shift location"}. Open the app to clock in.`,
                data: {
                    type: "shift_arrival",
                    shiftId: relevantShift?.id || null,
                    url: "/(tabs)",
                },
            }).catch(err => console.error("Arrival push failed", err));
        }
    }

    // 6. Detect Departure & 7. Store Record (No explicit transaction because neon-http doesn't support .transaction())
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
            }
        }
    }

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
