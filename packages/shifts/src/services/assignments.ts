import { db, TxOrDb } from "@repo/database";
import { shiftAssignment, assignmentAuditEvent, location, shift } from "@repo/database/schema";
import { eq, and, desc, sql, inArray, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { differenceInMinutes } from "date-fns";
import { AppError } from "@repo/observability";

export class AssignmentService {

    // Integrity: Centralized Clock-In with Hardware Verification
    // Implements "Soft Fail": Records the punch but flags for review if outside geofence.
    // Helper type for transaction
    // In a real app we might export this from @repo/database
    // Using any for now to avoid prolonged type gymnastics with Drizzle generics in this refactor
    // equivalent to: PgTransaction<any, any, any>
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

    // Integrity: Centralized Clock-Out
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

                    // STORE DURATION (Minutes) in estimatedCostCents as per instruction
                    estimatedCostCents: totalWorkedMinutes,

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

    // Legacy/Admin Manual Update
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

            if (!assignment) throw new Error("Assignment not found");

            const targetShift = await tx.query.shift.findFirst({
                where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
                columns: { startTime: true }
            });

            if (!targetShift) throw new Error("Shift not found");

            // Snapping Logic
            let effectiveClockIn = data.clockIn;
            if (data.clockIn) {
                if (actorRole === 'member' && data.clockIn < targetShift.startTime) {
                    effectiveClockIn = targetShift.startTime;
                } else {
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
                    effectiveClockOut: data.clockOut,
                    breakMinutes: data.breakMinutes || 0,
                    estimatedCostCents: totalWorkedMinutes, // STORING MINUTES
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
