
import { db } from "@repo/database";
import { shift, shiftAssignment, assignmentAuditEvent, location } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { calculateShiftPay } from "../utils/calculations";
import { differenceInMinutes } from "date-fns";

export class AssignmentService {
    static async updateStatus(
        actorId: string,
        assignmentId: string,
        newStatus: string,
        metadata: Record<string, any> = {},
        dbTx: any = db // Allow passing transaction
    ) {
        // 1. Get current status
        const currentAssignment = await dbTx.query.shiftAssignment.findFirst({
            where: eq(shiftAssignment.id, assignmentId),
            columns: { status: true, workerId: true }
        });

        if (!currentAssignment) {
            throw new Error("Assignment not found");
        }

        const previousStatus = currentAssignment.status;

        // 2. Update status
        await dbTx.update(shiftAssignment)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(shiftAssignment.id, assignmentId));

        // 3. Create Audit Log
        await dbTx.insert(assignmentAuditEvent).values({
            id: nanoid(),
            assignmentId: assignmentId,
            actorId: actorId,
            previousStatus: previousStatus,
            newStatus: newStatus,
            metadata: metadata,
            timestamp: new Date()
        });
    }

    static async updateTimesheet(
        actorId: string,
        orgId: string,
        shiftId: string,
        workerId: string,
        data: { clockIn?: Date | null; clockOut?: Date | null; breakMinutes?: number }
    ) {
        const assignment = await db.query.shiftAssignment.findFirst({
            where: and(
                eq(shiftAssignment.shiftId, shiftId),
                eq(shiftAssignment.workerId, workerId)
            )
        });

        if (!assignment) throw new Error("Assignment not found");

        const targetShift = await db.query.shift.findFirst({
            where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
            columns: { price: true }
        });

        if (!targetShift) throw new Error("Shift not found");

        let grossPayCents = 0;
        if (data.clockIn && data.clockOut) {
            const totalMinutes = differenceInMinutes(data.clockOut, data.clockIn);
            const billableMinutes = Math.max(0, totalMinutes - (data.breakMinutes || 0));
            grossPayCents = calculateShiftPay(billableMinutes, targetShift.price || 0);
        }

        await db.transaction(async (tx) => {
            await tx.update(shiftAssignment)
                .set({
                    clockIn: data.clockIn,
                    clockOut: data.clockOut,
                    breakMinutes: data.breakMinutes || 0,
                    grossPayCents,
                    status: 'completed',
                    updatedAt: new Date()
                })
                .where(eq(shiftAssignment.id, assignment.id));

            // Audit the status change to completed if it wasn't already
            if (assignment.status !== 'completed') {
                await tx.insert(assignmentAuditEvent).values({
                    id: nanoid(),
                    assignmentId: assignment.id,
                    actorId: actorId,
                    previousStatus: assignment.status,
                    newStatus: 'completed',
                    metadata: { reason: "Manual Timesheet Update" },
                    timestamp: new Date()
                });
            }
        });
    }

    static async verifyClockIn(
        assignmentId: string,
        coordinates: { lat: number; lng: number; accuracy: number },
        locationId: string
    ) {
        // Fetch location geofence logic
        const loc = await db.query.location.findFirst({
            where: eq(location.id, locationId),
            columns: { position: true, geofenceRadius: true }
        });

        if (!loc || !loc.position) return { verified: false, reason: "No location geofence" };

        // PostGIS distance calculation would happen here or via SQL
        // mimicking "Verify Clock-In" logic

        return { verified: true };
    }
}
