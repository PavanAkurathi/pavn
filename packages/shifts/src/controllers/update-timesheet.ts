
import { db } from "@repo/database";
import { shiftAssignment } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";

interface UpdateTimesheetPayload {
    shiftId: string;
    workerId: string;
    action: "update_time" | "mark_no_show";
    data?: {
        clockIn?: string;
        clockOut?: string;
        breakMinutes?: number;
    };
}

export const updateTimesheetController = async (req: Request): Promise<Response> => {
    try {
        const body = (await req.json()) as UpdateTimesheetPayload;
        const { shiftId, workerId, action, data } = body;

        // Validation
        if (!shiftId || !workerId || !action) {
            return new Response("Missing required fields", { status: 400 });
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
            return new Response("Invalid action", { status: 400 });
        }

        return Response.json({ success: true }, { status: 200 });

    } catch (error) {
        console.error("Update Timesheet Error:", error);
        return new Response(JSON.stringify({
            error: "Failed to update timesheet",
            details: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};
