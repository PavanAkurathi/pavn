import { applyManagerTimesheetUpdate, getAssignment, updateAssignmentStatus } from "./assignment-admin";
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
        const assignment = await getAssignment(shiftId, workerId, orgId);
        if (!assignment) throw new AppError("Assignment not found", "NOT_FOUND", 404);

        await updateAssignmentStatus(
            actorId,
            assignment.id,
            'no_show',
            { reason: "Manager marked no-show" },
            orgId
        );
    }
    else if (action === 'update_time') {
        const clockIn =
            data && "clockIn" in data
                ? (data.clockIn ? new Date(data.clockIn) : null)
                : undefined;
        const clockOut =
            data && "clockOut" in data
                ? (data.clockOut ? new Date(data.clockOut) : null)
                : undefined;

        await applyManagerTimesheetUpdate(
            actorId,
            orgId,
            shiftId,
            workerId,
            {
                clockIn,
                clockOut,
                breakMinutes: data?.breakMinutes
            },
            'manager'
        );
    } else {
        throw new AppError("Invalid action", "INVALID_ACTION", 400);
    }

    return { success: true };
};
