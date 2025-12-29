// packages/shifts/src/controllers/approve.ts

import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { differenceInMinutes } from "date-fns";
import { mapShiftToDto } from "../utils/mapper";

export const approveShiftController = async (shiftId: string): Promise<Response> => {
    try {
        // 1. Fetch Data
        const shiftRecord = await db.query.shift.findFirst({
            where: eq(shift.id, shiftId),
            with: {
                assignments: true,
                organization: true,
                location: true
            }
        });

        if (!shiftRecord) return new Response("Shift not found", { status: 404 });
        if (shiftRecord.status === 'approved') return new Response("Already approved", { status: 400 });

        // 2. Audit Assignments
        const dirtyAssignments: string[] = [];
        const updates: {
            id: string;
            status: "no_show" | "completed";
            grossPayCents: number;
            hourlyRateSnapshot: number | null;
        }[] = [];

        for (const assign of shiftRecord.assignments) {
            // CASE: No Show (Empty times)
            if (!assign.clockIn && !assign.clockOut) {
                updates.push({
                    id: assign.id,
                    status: 'no_show',
                    grossPayCents: 0,
                    hourlyRateSnapshot: null
                });
                continue;
            }

            // CASE: Dirty Data (Missing Clock Out)
            if (assign.clockIn && !assign.clockOut) {
                dirtyAssignments.push(assign.workerId);
                continue;
            }

            // CASE: Valid (Calculate Pay)
            if (assign.clockIn && assign.clockOut) {
                // differenceInMinutes returns signed integer, Ensure positive and valid range
                const totalMinutes = differenceInMinutes(assign.clockOut, assign.clockIn);

                // Subtract break minutes if they exist
                const billableMinutes = Math.max(0, totalMinutes - (assign.breakMinutes || 0));

                const hours = billableMinutes / 60;

                // Pay = Hours * Shift Price (Rate is stored as price in shift table)
                const rate = shiftRecord.price || 0;
                const pay = Math.round(hours * rate);

                updates.push({
                    id: assign.id,
                    status: 'completed',
                    grossPayCents: pay,
                    hourlyRateSnapshot: rate
                });
            }
        }

        // 3. Block if Dirty
        if (dirtyAssignments.length > 0) {
            return new Response(JSON.stringify({
                error: "Cannot approve: Workers missing clock-out times.",
                workerIds: dirtyAssignments
            }), {
                status: 409,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 4. Commit Changes
        // NOTE: Avoiding db.transaction due to potential Neon HTTP driver limitations.
        // Using Promise.all for performance, though strict atomicity is compromised.

        // Update Assignments
        await Promise.all(updates.map(u =>
            db.update(shiftAssignment)
                .set({
                    status: u.status,
                    grossPayCents: u.grossPayCents,
                    hourlyRateSnapshot: u.hourlyRateSnapshot
                })
                .where(eq(shiftAssignment.id, u.id))
        ));

        // Update Shift Status
        await db.update(shift)
            .set({ status: 'approved' })
            .where(eq(shift.id, shiftId));

        return Response.json({ success: true }, { status: 200 });

    } catch (error) {
        console.error("Approve/Audit Error:", error);
        return new Response(JSON.stringify({
            error: "Failed to approve shift",
            details: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};
