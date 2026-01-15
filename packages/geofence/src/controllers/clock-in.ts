// packages/geofence/src/controllers/clock-in.ts

import { db } from "@repo/database";
import { shiftAssignment, shift, workerLocation } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { calculateDistance, parseCoordinate } from "../utils/distance";
import { applyClockInRules } from "../utils/time-rules";

const ClockInSchema = z.object({
    shiftId: z.string(),
    latitude: z.string(),
    longitude: z.string(),
    accuracyMeters: z.number().optional(),
});

export async function clockInController(
    req: Request,
    workerId: string,
    orgId: string
): Promise<Response> {
    try {
        // 1. Validate input
        const body = await req.json();
        const parseResult = ClockInSchema.safeParse(body);

        if (!parseResult.success) {
            return Response.json({
                error: "Invalid request",
                details: parseResult.error.flatten()
            }, { status: 400 });
        }

        const { shiftId, latitude, longitude, accuracyMeters } = parseResult.data;

        // 2. Fetch shift with location and assignment
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
            return Response.json({ error: "Shift not found" }, { status: 404 });
        }

        const assignment = shiftRecord.assignments[0];
        if (!assignment) {
            return Response.json({ error: "You are not assigned to this shift" }, { status: 403 });
        }

        if (assignment.clockIn) {
            return Response.json({
                error: "Already clocked in",
                clockInTime: assignment.clockIn
            }, { status: 400 });
        }

        // 3. Verify geofence
        const venueLocation = shiftRecord.location;
        if (!venueLocation?.latitude || !venueLocation?.longitude) {
            return Response.json({
                error: "Venue location not configured",
                code: "VENUE_NOT_GEOCODED"
            }, { status: 400 });
        }

        const workerLat = parseCoordinate(latitude);
        const workerLng = parseCoordinate(longitude);
        const venueLat = parseCoordinate(venueLocation.latitude);
        const venueLng = parseCoordinate(venueLocation.longitude);

        if (!workerLat || !workerLng || !venueLat || !venueLng) {
            return Response.json({ error: "Invalid coordinates" }, { status: 400 });
        }

        const distanceMeters = calculateDistance(workerLat, workerLng, venueLat, venueLng);
        const radius = venueLocation.geofenceRadius || 100;

        if (distanceMeters > radius) {
            return Response.json({
                error: "You must be at the venue to clock in",
                code: "OUTSIDE_GEOFENCE",
                distanceMeters,
                requiredRadius: radius
            }, { status: 400 });
        }

        // 4. Apply time rules

        // 4. Time Validation
        const now = new Date();
        const scheduledStart = new Date(shiftRecord.startTime);

        const EARLY_BUFFER_MINUTES = 15;
        const earliestClockIn = new Date(scheduledStart.getTime() - EARLY_BUFFER_MINUTES * 60 * 1000);

        if (now < earliestClockIn) {
            return Response.json({
                error: `Cannot clock in more than ${EARLY_BUFFER_MINUTES} minutes before shift`,
                code: "TOO_EARLY",
                shiftStart: scheduledStart.toISOString(),
                earliestClockIn: earliestClockIn.toISOString()
            }, { status: 400 });
        }

        const clockInResult = applyClockInRules(now, scheduledStart);

        // 5. Transaction: Update assignment, shift (if needed), and log location
        await db.transaction(async (tx) => {
            // A. Update Assignment
            await tx.update(shiftAssignment)
                .set({
                    clockIn: clockInResult.recordedTime,
                    clockInLatitude: latitude,
                    clockInLongitude: longitude,
                    clockInVerified: true,
                    clockInMethod: 'geofence',
                    updatedAt: now,
                })
                .where(eq(shiftAssignment.id, assignment.id));

            // B. Update Shift Status (if needed)
            if (shiftRecord.status === 'assigned') {
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
                latitude,
                longitude,
                accuracyMeters: accuracyMeters || null,
                venueLatitude: venueLocation.latitude,
                venueLongitude: venueLocation.longitude,
                distanceToVenueMeters: distanceMeters,
                isOnSite: true,
                eventType: 'clock_in',
                recordedAt: now,
                // Provide default for device timestamp since we don't assume client provides it for clock in explicitly in D3 requirements
                deviceTimestamp: now,
            });
        });

        // 8. Return success
        return Response.json({
            success: true,
            data: {
                clockInTime: clockInResult.recordedTime.toISOString(),
                actualTime: clockInResult.actualTime.toISOString(),
                scheduledTime: clockInResult.scheduledTime.toISOString(),
                wasEarly: clockInResult.isEarly,
                wasLate: clockInResult.isLate,
                minutesDifference: clockInResult.minutesDifference,
            }
        });

    } catch (error) {
        console.error("[CLOCK_IN] Error:", error);
        return Response.json({
            error: "Failed to clock in",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
