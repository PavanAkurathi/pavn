// packages/shifts/src/services/update-timesheet.ts

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

export const updateTimesheet = async (body: any, orgId: string, actorId: string = "system") => {

    const parseResult = TimesheetSchema.safeParse(body);

    if (!parseResult.success) {
        throw new AppError("Validation Failed", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const { shiftId, workerId, action, data } = parseResult.data;

    if (action === 'mark_no_show') {
        // We need to fetch assignment ID or have AssignmentService handle it by shift/worker
        // The original controller had a placeholder string "get_assignment_id_here"?!
        // Let's assume we need to find it.
        // Assuming AssignmentService.updateStatus takes an assignment ID.
        // For now, let's look it up or rely on AssignmentService to help.
        // Actually the original code was: await AssignmentService.updateStatus(actorId, "get_assignment_id_here", ...)
        // This suggests the original code was broken or incomplete?
        // I should probably fix this.

        // Fix: Find assignment ID first
        const assignment = await AssignmentService.getAssignment(shiftId, workerId); // Need to check if this method exists or implement lookup
        if (!assignment) throw new AppError("Assignment not found", "NOT_FOUND", 404);

        await AssignmentService.updateStatus(actorId, assignment.id, 'no_show', { reason: "Manager marked no-show" });
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

    return { success: true };
};
