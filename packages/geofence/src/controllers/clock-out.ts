// packages/geofence/src/controllers/clock-out.ts

import { db } from "@repo/database";
import { shiftAssignment, shift, workerLocation } from "@repo/database/schema";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { logAudit } from "@repo/database";
import { calculateDistance } from "../utils/distance";
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

        // 3. Verify geofence
        const venueLocation = shiftRecord.location;
        let isOnSite = true;
        let distanceMeters = 0;

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
            // A. Update Assignment
            // A. Update Assignment with Optimistic Locking
            const updatedArgs = await tx.update(shiftAssignment)
                .set({
                    clockOut: clockOutResult.recordedTime,
                    clockOutLatitude: latitude,
                    clockOutLongitude: longitude,
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
            // Note: We need to query again or rely on the previous fetch. 
            // Querying inside TX is safer for concurrency but for now we will reuse the logic 
            // BUT we should query inside the TX to see the latest state if we want strict correctness.
            // For MVP, simply querying normally is fine.
            const allAssignments = await tx.query.shiftAssignment.findMany({
                where: eq(shiftAssignment.shiftId, shiftId)
            });

            // We check if everyone EXCEPT current user (who we just updated) is done
            // OR we just check the list we just fetched which includes the update we just made? 
            // Wait, inside transaction, the update above is visible to us.
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
                latitude,
                longitude,
                accuracyMeters: accuracyMeters || null,
                venueLatitude: venueLocation?.latitude || null,
                venueLongitude: venueLocation?.longitude || null,
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
