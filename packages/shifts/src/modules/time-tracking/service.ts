import { db, TxOrDb } from "@repo/database";
import { shiftAssignment, assignmentAuditEvent, location, shift } from "@repo/database/schema";
import { eq, and, desc, sql, inArray, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { differenceInMinutes } from "date-fns";
import { AppError } from "@repo/observability";

export class AssignmentService {

    /**
     * @deprecated Use `@repo/geofence` clockIn service instead.
     * This legacy version lacks anti-spoofing, proper geofence enforcement,
     * location recording, and notification cleanup.
     */
    static async clockIn(
        actorId: string,
        shiftId: string,
        workerId: string,
        coordinates: { lat: number; lng: number; accuracy: number },
        deviceMetadata: Record<string, any>,
        tx?: TxOrDb // Optional transaction context
    ) {
        // Logic runner that takes a transaction (existing or new)
        const execute = async (tx: TxOrDb) => {
            // 1. Fetch Assignment & Shift details
            const assignment = await tx.query.shiftAssignment.findFirst({
                where: and(
                    eq(shiftAssignment.shiftId, shiftId),
                    eq(shiftAssignment.workerId, workerId)
                ),
                with: {
                    shift: {
                        columns: { locationId: true, organizationId: true, startTime: true }
                    }
                }
            });

            if (!assignment) throw new AppError("Assignment not found", "NOT_FOUND", 404);
            if (!assignment.shift) throw new AppError("Shift data corrupt", "INTERNAL_ERROR", 500);

            // 2. Hardware Verification (Geofence)
            // Soft Fail: We check, but we do NOT block. We flag.
            const verification = await this.verifyClockIn(
                assignment.id,
                coordinates,
                assignment.shift.locationId || ""
            );

            const now = new Date();
            const isVerified = verification.verified;
            const reviewReason = isVerified ? null : 'geofence_mismatch';

            // 3. Update Assignment (Integrity: Record Hardware position & Timestamp)
            await tx.update(shiftAssignment)
                .set({
                    actualClockIn: now,
                    // Snapping for Member Role: If early, snap to start. If late, use actual.
                    effectiveClockIn: now < assignment.shift.startTime ? assignment.shift.startTime : now,
                    status: 'in-progress',

                    // Verification Status
                    clockInVerified: isVerified,
                    needsReview: !isVerified, // Flag for manager if outside geofence
                    reviewReason: reviewReason,

                    clockInPosition: sql`ST_SetSRID(ST_MakePoint(${coordinates.lng}, ${coordinates.lat}), 4326)`,
                    clockInMethod: 'geofence',
                    updatedAt: now
                })
                .where(eq(shiftAssignment.id, assignment.id));

            // 4. Audit Log
            await tx.insert(assignmentAuditEvent).values({
                id: nanoid(),
                assignmentId: assignment.id,
                actorId: actorId,
                previousStatus: assignment.status,
                newStatus: 'in-progress',
                metadata: {
                    ...deviceMetadata,
                    coordinates,
                    accuracy: coordinates.accuracy,
                    verification: isVerified ? 'passed' : 'failed',
                    distance: verification.distance, // Store distance for review
                    reason: verification.reason
                },
                timestamp: now
            });

            return {
                success: true,
                timestamp: now,
                verified: isVerified,
                message: isVerified ? "Clocked in successfully" : "Clocked in (Geofence Warning)"
            };
        };

        // If transaction provided, use it. Else start new one.
        if (tx) return execute(tx);
        return await db.transaction(execute);
    }

    /**
     * @deprecated Use `@repo/geofence` clockOut service instead.
     * This legacy version lacks geofence enforcement and location recording.
     */
    static async clockOut(
        actorId: string,
        shiftId: string,
        workerId: string,
        coordinates: { lat: number; lng: number; accuracy: number },
        deviceMetadata: Record<string, any>,
        tx?: TxOrDb
    ) {
        const execute = async (tx: TxOrDb) => {
            const assignment = await tx.query.shiftAssignment.findFirst({
                where: and(
                    eq(shiftAssignment.shiftId, shiftId),
                    eq(shiftAssignment.workerId, workerId)
                )
            });

            if (!assignment) throw new AppError("Assignment not found", "NOT_FOUND", 404);

            const now = new Date();

            // Calculate Duration
            // We need the effective clock in to calculate total worked minutes.
            // If it's missing (shouldn't be), fallback to actual or now (0 minutes).
            const effectiveIn = assignment.effectiveClockIn || assignment.actualClockIn || now;
            const diffMinutes = differenceInMinutes(now, effectiveIn);
            const totalWorkedMinutes = Math.max(0, diffMinutes - (assignment.breakMinutes || 0));

            // 3. Update Assignment
            await tx.update(shiftAssignment)
                .set({
                    actualClockOut: now,
                    effectiveClockOut: now,
                    status: 'completed',
                    clockOutVerified: true, // Assuming valid for now, or could check geofence on exit too
                    clockOutPosition: sql`ST_SetSRID(ST_MakePoint(${coordinates.lng}, ${coordinates.lat}), 4326)`,
                    clockOutMethod: 'geofence',

                    // STORE DURATION (Minutes) in totalDurationMinutes (TICKET-001)
                    totalDurationMinutes: totalWorkedMinutes,
                    payoutAmountCents: null, // Reset pay until approved

                    updatedAt: now
                })
                .where(eq(shiftAssignment.id, assignment.id));

            // 4. Audit Log
            await tx.insert(assignmentAuditEvent).values({
                id: nanoid(),
                assignmentId: assignment.id,
                actorId: actorId,
                previousStatus: assignment.status,
                newStatus: 'completed',
                metadata: {
                    ...deviceMetadata,
                    coordinates,
                    action: 'clock_out',
                    totalWorkedMinutes
                },
                timestamp: now
            });

            return { success: true, timestamp: now };
        };

        if (tx) return execute(tx);
        return await db.transaction(execute);
    }

    // Admin/Manager Manual Timesheet Update
    // Snapping rules:
    //   - actorRole 'member' (worker): effectiveClockIn snaps to scheduledStart if early
    //   - actorRole 'manager': NO snapping — trust the manager's time exactly
    static async updateTimesheet(
        actorId: string,
        orgId: string,
        shiftId: string,
        workerId: string,
        data: { clockIn?: Date | null; clockOut?: Date | null; breakMinutes?: number },
        actorRole: 'manager' | 'member' = 'member',
        tx?: TxOrDb
    ) {
        const execute = async (tx: TxOrDb) => {
            const assignment = await tx.query.shiftAssignment.findFirst({
                where: and(
                    eq(shiftAssignment.shiftId, shiftId),
                    eq(shiftAssignment.workerId, workerId)
                )
            });

            if (!assignment) throw new AppError("Assignment not found", "NOT_FOUND", 404);

            const targetShift = await tx.query.shift.findFirst({
                where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
                columns: { startTime: true }
            });

            if (!targetShift) throw new AppError("Shift not found", "NOT_FOUND", 404);

            // Snapping Logic
            let effectiveClockIn = data.clockIn;
            if (data.clockIn) {
                if (actorRole === 'member' && data.clockIn < targetShift.startTime) {
                    // Worker self-update: snap to scheduled start
                    effectiveClockIn = targetShift.startTime;
                } else {
                    // Manager update: use exact time (no snapping)
                    effectiveClockIn = data.clockIn;
                }
            }

            // Calculate Duration (Minutes Only)
            let totalWorkedMinutes = 0;
            if (effectiveClockIn && data.clockOut) {
                const diff = differenceInMinutes(data.clockOut, effectiveClockIn);
                totalWorkedMinutes = Math.max(0, diff - (data.breakMinutes || 0));
            }

            await tx.update(shiftAssignment)
                .set({
                    actualClockIn: data.clockIn,
                    effectiveClockIn: effectiveClockIn,
                    actualClockOut: data.clockOut,
                    effectiveClockOut: data.clockOut,
                    breakMinutes: data.breakMinutes || 0,
                    totalDurationMinutes: totalWorkedMinutes,
                    payoutAmountCents: null,
                    status: 'completed',
                    updatedAt: new Date()
                })
                .where(eq(shiftAssignment.id, assignment.id));

            if (assignment.status !== 'completed') {
                await tx.insert(assignmentAuditEvent).values({
                    id: nanoid(),
                    assignmentId: assignment.id,
                    actorId: actorId,
                    previousStatus: assignment.status,
                    newStatus: 'completed',
                    metadata: { reason: "Manual Timesheet Update", totalMinutes: totalWorkedMinutes },
                    timestamp: new Date()
                });
            }
        };

        if (tx) return execute(tx);
        return await db.transaction(execute);
    }

    static async verifyClockIn(
        assignmentId: string,
        coordinates: { lat: number; lng: number; accuracy: number },
        locationId: string
    ) {
        if (!locationId) return { verified: false, reason: "No location linked to shift", distance: 0 };

        const point = `POINT(${coordinates.lng} ${coordinates.lat})`;

        // Use PostGIS to get boolean check AND actual distance
        const result = await db.select({
            isWithinRange: sql<boolean>`
                ST_DWithin(
                    ${location.position},
                    ST_SetSRID(ST_GeomFromText(${point}), 4326)::geography,
                    ${location.geofenceRadius}
                )
            `,
            distance: sql<number>`
                ST_Distance(
                    ${location.position},
                    ST_SetSRID(ST_GeomFromText(${point}), 4326)::geography
                )
            `
        })
            .from(location)
            .where(eq(location.id, locationId))
            .limit(1);

        const [res] = result;

        if (!res) {
            return { verified: false, reason: "Location not found", distance: 0 };
        }

        if (!res.isWithinRange) {
            return {
                verified: false,
                reason: "Outside geofence",
                distance: Math.round(res.distance) // Return distance in meters
            };
        }

        return { verified: true, distance: Math.round(res.distance) };
    }

    /**
     * Get assignment by shift and worker
     */
    static async getAssignment(shiftId: string, workerId: string) {
        return await db.query.shiftAssignment.findFirst({
            where: and(
                eq(shiftAssignment.shiftId, shiftId),
                eq(shiftAssignment.workerId, workerId)
            )
        });
    }

    /**
     * Update assignment status with audit log
     */
    static async updateStatus(
        actorId: string,
        assignmentId: string,
        status: string,
        metadata: Record<string, any> = {},
        tx?: TxOrDb
    ) {
        const execute = async (tx: TxOrDb) => {
            const current = await tx.query.shiftAssignment.findFirst({
                where: eq(shiftAssignment.id, assignmentId)
            });

            if (!current) throw new AppError("Assignment not found", "NOT_FOUND", 404);

            await tx.update(shiftAssignment)
                .set({
                    status: status,
                    updatedAt: new Date()
                })
                .where(eq(shiftAssignment.id, assignmentId));

            await tx.insert(assignmentAuditEvent).values({
                id: nanoid(),
                assignmentId,
                actorId,
                previousStatus: current.status,
                newStatus: status,
                metadata,
                timestamp: new Date()
            });
        };

        if (tx) return execute(tx);
        return await db.transaction(execute);
    }
}
