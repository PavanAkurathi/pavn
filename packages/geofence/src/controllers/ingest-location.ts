// packages/geofence/src/controllers/ingest-location.ts

import { db } from "@repo/database";
import { workerLocation, shiftAssignment, shift, member } from "@repo/database/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { calculateDistance } from "../utils/distance";
import { sendSMS } from "@repo/auth";

const LocationPingSchema = z.object({
    latitude: z.string(),
    longitude: z.string(),
    accuracyMeters: z.number().optional(),
    deviceTimestamp: z.string().optional(),  // ISO string
});

export async function ingestLocationController(
    req: Request,
    workerId: string,
    orgId: string
): Promise<Response> {
    try {
        // 1. Validate input
        const body = await req.json();
        const parseResult = LocationPingSchema.safeParse(body);

        if (!parseResult.success) {
            return Response.json({
                error: "Invalid location data",
                details: parseResult.error.flatten()
            }, { status: 400 });
        }

        const { latitude, longitude, accuracyMeters, deviceTimestamp } = parseResult.data;

        // 2. Verify worker belongs to org
        const membership = await db.query.member.findFirst({
            where: and(
                eq(member.userId, workerId),
                eq(member.organizationId, orgId)
            ),
            with: {
                user: true
            }
        });

        if (!membership) {
            return Response.json({ error: "Worker not in organization" }, { status: 403 });
        }

        // 3. Find active/upcoming shift for this worker (within 30 min window)
        const now = new Date();
        const windowStart = new Date(now.getTime() - 30 * 60 * 1000);  // 30 min ago
        const windowEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours ahead

        const activeAssignment = await db.query.shiftAssignment.findFirst({
            where: and(
                eq(shiftAssignment.workerId, workerId),
                inArray(shiftAssignment.status, ['active'])
            ),
            with: {
                shift: {
                    with: {
                        location: true
                    }
                }
            }
        });

        // Filter by time window
        let relevantShift = null;
        let relevantAssignment = null;
        let venueLocation = null;

        if (activeAssignment?.shift) {
            const shiftStart = new Date(activeAssignment.shift.startTime);
            const shiftEnd = new Date(activeAssignment.shift.endTime);

            // Is this shift within our tracking window?
            if (shiftStart <= windowEnd && shiftEnd >= windowStart) {
                relevantShift = activeAssignment.shift;
                relevantAssignment = activeAssignment;
                venueLocation = activeAssignment.shift.location;
            }
        }

        // 4. Calculate distance to venue (if we have a relevant shift)
        let distanceMeters: number | null = null;
        let isOnSite = false;
        let eventType = 'ping';

        if (venueLocation?.latitude && venueLocation?.longitude) {
            const workerLat = Number(latitude);
            const workerLng = Number(longitude);
            const venueLat = Number(venueLocation.latitude);
            const venueLng = Number(venueLocation.longitude);

            if (workerLat && workerLng && venueLat && venueLng) {
                distanceMeters = calculateDistance(workerLat, workerLng, venueLat, venueLng);
                const radius = venueLocation.geofenceRadius || 100;
                isOnSite = distanceMeters <= radius;
            }
        }

        // 5. Detect arrival (transition from outside to inside geofence)
        if (isOnSite && relevantAssignment && !relevantAssignment.clockIn) {
            // Check if this is first time on-site
            const previousPing = relevantShift ? await db.query.workerLocation.findFirst({
                where: and(
                    eq(workerLocation.workerId, workerId),
                    eq(workerLocation.shiftId, relevantShift.id)
                ),
                orderBy: [desc(workerLocation.recordedAt)]
            }) : null;

            if (!previousPing || !previousPing.isOnSite) {
                eventType = 'arrival';
                // TODO: Trigger push notification + SMS
                // await sendArrivalNotification(workerId, relevantShift!);
                console.log(`[GEOFENCE] Worker ${workerId} arrived at ${venueLocation?.name}`);

                if (membership.user.phoneNumber) {
                    const message = `Hi ${membership.user.name}, you have arrived at ${venueLocation?.name}. Please remember to clock in using the app.`;
                    sendSMS(membership.user.phoneNumber, message).catch(err => {
                        console.error("[GEOFENCE] Failed to send arrival SMS:", err);
                    });
                }
            }
        }

        // 6. Detect departure (leaving geofence while clocked in, without clocking out)
        if (!isOnSite && relevantAssignment?.clockIn && !relevantAssignment.clockOut) {
            const previousPing = relevantShift ? await db.query.workerLocation.findFirst({
                where: and(
                    eq(workerLocation.workerId, workerId),
                    eq(workerLocation.shiftId, relevantShift.id)
                ),
                orderBy: [desc(workerLocation.recordedAt)]
            }) : null;

            if (previousPing?.isOnSite) {
                eventType = 'departure';

                // Flag the assignment for review
                await db.update(shiftAssignment)
                    .set({
                        needsReview: true,
                        reviewReason: 'left_geofence',
                        lastKnownLatitude: latitude,
                        lastKnownLongitude: longitude,
                        lastKnownAt: now,
                        updatedAt: now,
                    })
                    .where(eq(shiftAssignment.id, relevantAssignment.id));

                console.log(`[GEOFENCE] Worker ${workerId} left geofence without clocking out!`);

                // Send Notification (WH-013)
                if (membership.user.phoneNumber) {
                    const message = `Hi ${membership.user.name}, we detected you left the venue. You have been flagged for review. Please clock out or contact your manager.`;
                    // Fire and forget (don't block response)
                    sendSMS(membership.user.phoneNumber, message).catch(err => {
                        console.error("[GEOFENCE] Failed to send departure SMS:", err);
                    });
                }
            }
        }

        // 7. Store location record
        const locationRecord = {
            id: nanoid(),
            workerId,
            shiftId: relevantShift?.id || null, // Allow null if no relevant shift but we tracked it
            organizationId: orgId,
            latitude,
            longitude,
            accuracyMeters: accuracyMeters || null,
            venueLatitude: venueLocation?.latitude || null,
            venueLongitude: venueLocation?.longitude || null,
            distanceToVenueMeters: distanceMeters,
            isOnSite,
            eventType,
            recordedAt: now,
            deviceTimestamp: deviceTimestamp ? new Date(deviceTimestamp) : null,
        };

        await db.insert(workerLocation).values(locationRecord);

        // 8. Return status
        return Response.json({
            success: true,
            data: {
                isOnSite,
                distanceMeters,
                eventType,
                shiftId: relevantShift?.id || null,
                canClockIn: isOnSite && relevantAssignment && !relevantAssignment.clockIn,
                canClockOut: isOnSite && relevantAssignment?.clockIn && !relevantAssignment.clockOut,
            }
        });

    } catch (error) {
        console.error("[INGEST_LOCATION] Error:", error);
        return Response.json({
            error: "Failed to process location",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
