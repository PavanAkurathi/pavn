// packages/shifts/src/controllers/update-timesheet.ts

import { AssignmentService } from "../services/assignments";
import { AppError } from "@repo/observability";
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

    const body = await req.json();
    const parseResult = TimesheetSchema.safeParse(body);

    if (!parseResult.success) {
        throw new AppError("Validation Failed", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const { shiftId, workerId, action, data } = parseResult.data;

    // TODO: Get real actor ID from Context (user ID)
    const actorId = "system";

    if (action === 'mark_no_show') {
        await AssignmentService.updateStatus(actorId, "get_assignment_id_here", 'no_show', { reason: "Manager marked no-show" });
    }
    else if (action === 'update_time') {
        const clockIn = data?.clockIn ? new Date(data.clockIn) : null;
        const clockOut = data?.clockOut ? new Date(data.clockOut) : null;

        await AssignmentService.updateTimesheet(
            actorId,
            orgId,
            shiftId,
            workerId,
            {
                clockIn,
                clockOut,
                breakMinutes: data?.breakMinutes
            }
        );
    } else {
        throw new AppError("Invalid action", "INVALID_ACTION", 400);
    }

    return Response.json({ success: true }, { status: 200 });
};
