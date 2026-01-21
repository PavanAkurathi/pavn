// packages/geofence/src/controllers/clock-out.ts

import { db } from "@repo/database";
import { shiftAssignment, shift, workerLocation, location } from "@repo/database/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { logAudit } from "@repo/database";
import { applyClockOutRules } from "../utils/time-rules";
import { validateShiftTransition } from "@repo/config";

const ClockOutSchema = z.object({
    shiftId: z.string(),
    latitude: z.string(),
    longitude: z.string(),
    accuracyMeters: z.number().optional(),
});

export async function clockOutController(
    req: Request,
    workerId: string,
    orgId: string
): Promise<Response> {
    try {
        // 1. Validate input
        const body = await req.json();
        const parseResult = ClockOutSchema.safeParse(body);

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

        if (!assignment.clockIn) {
            return Response.json({ error: "You must clock in first" }, { status: 400 });
        }

        if (assignment.clockOut) {
            return Response.json({
                error: "Already clocked out",
                clockOutTime: assignment.clockOut
            }, { status: 400 });
        }

        // 3. Verify geofence using PostGIS
        const venueLocationId = shiftRecord.locationId;

        let isOnSite = true; // Default to true if no location needed? No, logic says verify geofence.
        let distanceMeters = 0;
        let radius = 100;

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
                radius = geoResult.radius || 100;
                isOnSite = !!geoResult.isWithin;
            } else {
                // Should ideally handle missing location record if ID exists but record gone?
                // But shiftRecord.location implies relation exists.
                // If shiftRecord.location is null, then venueLocationId might be null.
                // Checking logic below.
            }
        }
        // If venueLocationId is missing, what was old logic?
        // Old logic: checked if venueLocation?.latitude exists.
        // If no location, skip geofence check? Or fail?
        // Old code: if (venueLocation?.latitude ...) checks it. If not present, isOnSite = true (default initialized).
        // Wait, line 75 in original: let isOnSite = true;
        // Line 78: checks if lat/long exist.
        // If no location on shift, we assume no geofence needed?
        // Correct.

        if (!isOnSite) {
            return Response.json({
                error: "You must be at the venue to clock out",
                code: "OUTSIDE_GEOFENCE",
                distanceMeters,
                hint: "If you left early, ask your manager to adjust your timesheet"
            }, { status: 400 });
        }

        // 4. Apply time rules
        const now = new Date();
        const scheduledEnd = new Date(shiftRecord.endTime);
        const clockOutResult = applyClockOutRules(now, scheduledEnd);

        // 5. Transaction: Update assignment, shift (if needed), and log location
        await db.transaction(async (tx) => {
            const point = `POINT(${longitude} ${latitude})`;

            // A. Update Assignment with Optimistic Locking
            const updatedArgs = await tx.update(shiftAssignment)
                .set({
                    clockOut: clockOutResult.recordedTime,
                    clockOutPosition: sql`ST_GeogFromText(${point})`,
                    clockOutVerified: true,
                    clockOutMethod: 'geofence',
                    status: 'completed',
                    updatedAt: now,
                })
                .where(and(
                    eq(shiftAssignment.id, assignment.id),
                    isNull(shiftAssignment.clockOut) // GUARD: Only update if not already clocked out
                ))
                .returning({ id: shiftAssignment.id });

            if (updatedArgs.length === 0) {
                throw new Error("Already clocked out (Race Condition)");
            }

            // B. Check if all assignments complete → update shift status
            const allAssignments = await tx.query.shiftAssignment.findMany({
                where: eq(shiftAssignment.shiftId, shiftId)
            });

            // Check if everyone is done (including the one we just updated, as query sees uncommitted changes in same TX usually, or at least consistent snapshot)
            const allComplete = allAssignments.every(a =>
                a.clockOut !== null
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

            // C. Store Location Record
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
                deviceTimestamp: now
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

        // 8. Return success
        return Response.json({
            success: true,
            data: {
                clockOutTime: clockOutResult.recordedTime.toISOString(),
                actualTime: clockOutResult.actualTime.toISOString(),
                scheduledTime: clockOutResult.scheduledTime.toISOString(),
                wasEarly: clockOutResult.isEarly,
                wasLate: clockOutResult.isLate,
                minutesDifference: clockOutResult.minutesDifference,
            }
        });

    } catch (error) {
        console.error("[CLOCK_OUT] Error:", error);
        return Response.json({
            error: "Failed to clock out",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
