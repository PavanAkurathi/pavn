// packages/shifts/src/controllers/update-timesheet.ts


import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";

import { z } from "zod";

const TimesheetSchema = z.object({
    shiftId: z.string(),
    workerId: z.string(),
    action: z.enum(["update_time", "mark_no_show"]),
    data: z.object({
        clockIn: z.string().optional(),
        clockOut: z.string().optional(),
        breakMinutes: z.number().optional()
    }).optional()
});

export const updateTimesheetController = async (req: Request, orgId: string): Promise<Response> => {
    try {
        const body = await req.json();
        const parseResult = TimesheetSchema.safeParse(body);

        if (!parseResult.success) {
            return Response.json({
                error: "Validation Failed",
                details: parseResult.error.flatten()
            }, { status: 400 });
        }

        const { shiftId, workerId, action, data } = parseResult.data;

        // Verify Shift Ownership
        const validShift = await db.query.shift.findFirst({
            where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
            columns: { id: true }
        });

        if (!validShift) {
            return Response.json({ error: "Shift not found or access denied" }, { status: 403 });
        }

        if (action === 'mark_no_show') {
            await db.update(shiftAssignment)
                .set({
                    status: 'no_show',
                    clockIn: null,
                    clockOut: null,
                    breakMinutes: 0
                })
                .where(and(
                    eq(shiftAssignment.shiftId, shiftId),
                    eq(shiftAssignment.workerId, workerId)
                ));
        }
        else if (action === 'update_time') {
            await db.update(shiftAssignment)
                .set({
                    clockIn: data?.clockIn ? new Date(data.clockIn) : null,
                    clockOut: data?.clockOut ? new Date(data.clockOut) : null,
                    breakMinutes: data?.breakMinutes || 0,
                    status: 'completed' // Manually corrected means it's ready for approval audit
                })
                .where(and(
                    eq(shiftAssignment.shiftId, shiftId),
                    eq(shiftAssignment.workerId, workerId)
                ));
        } else {
            return Response.json({ error: "Invalid action" }, { status: 400 });
        }

        return Response.json({ success: true }, { status: 200 });

    } catch (error) {
        console.error("Update Timesheet Error:", error);
        return Response.json({
            error: "Failed to update timesheet",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
};
