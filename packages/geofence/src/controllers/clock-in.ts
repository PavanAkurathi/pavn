// packages/geofence/src/controllers/clock-in.ts

import { db } from "@repo/database";
import { shift, shiftAssignment, workerLocation, organization, location } from "@repo/database/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { applyClockInRules } from "../utils/time-rules";
import { validateShiftTransition } from "@repo/config";

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

        // 3. Verify geofence using PostGIS
        if (!shiftRecord.locationId) {
            return Response.json({
                error: "Venue location not configured",
                code: "VENUE_NOT_GEOCODED"
            }, { status: 400 });
        }

        const point = `POINT(${longitude} ${latitude})`;

        // Use SQL to check distance against the venue location
        // We query the location table directly to get the distance
        const [geoResult] = await db.select({
            isWithin: sql<boolean>`ST_DWithin(${location.position}, ST_GeogFromText(${point}), ${location.geofenceRadius}::integer)`,
            distance: sql<number>`ST_Distance(${location.position}, ST_GeogFromText(${point}))`,
            radius: location.geofenceRadius
        })
            .from(location)
            .where(eq(location.id, shiftRecord.locationId));

        if (!geoResult) {
            return Response.json({
                error: "Venue location not found",
                code: "VENUE_NOT_FOUND"
            }, { status: 404 });
        }

        const distanceMeters = Math.round(geoResult.distance || 0);
        const radius = geoResult.radius || 100;

        if (!geoResult.isWithin) {
            return Response.json({
                error: "You must be at the venue to clock in",
                code: "OUTSIDE_GEOFENCE",
                distanceMeters,
                requiredRadius: radius
            }, { status: 400 });
        }

        // 4. Time Validation
        const now = new Date();
        const scheduledStart = new Date(shiftRecord.startTime);

        // Fetch org config for buffer
        const orgConfig = await db.query.organization.findFirst({
            where: eq(organization.id, orgId),
            columns: { earlyClockInBufferMinutes: true }
        });

        const EARLY_BUFFER_MINUTES = orgConfig?.earlyClockInBufferMinutes || 60;
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
                    clockInPosition: sql`ST_GeogFromText(${point})`,
                    clockInVerified: true,
                    clockInMethod: 'geofence',
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
                position: sql`ST_GeogFromText(${point})`,
                accuracyMeters: accuracyMeters || null,
                venuePosition: sql`(SELECT position FROM ${location} WHERE ${location.id} = ${shiftRecord.locationId})`,
                distanceToVenueMeters: distanceMeters,
                isOnSite: true,
                eventType: 'clock_in',
                recordedAt: now,
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
