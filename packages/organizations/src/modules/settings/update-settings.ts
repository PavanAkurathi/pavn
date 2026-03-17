import { db } from "@repo/database";
import { organization } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@repo/observability";
import {
    ATTENDANCE_VERIFICATION_POLICY_VALUES,
    type AttendanceVerificationPolicy,
} from "@repo/config";

const isValidTimezone = (value: string) => {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
        return true;
    } catch {
        return false;
    }
};

const UpdateSettingsInputSchema = z.object({
    timezone: z.string().refine(isValidTimezone, "Must be a valid IANA timezone").optional(),
    earlyClockInBufferMinutes: z.int().min(0).max(720).optional(),
    regionalOvertimePolicy: z.enum(["weekly_40", "daily_8"]).optional(),
    attendanceVerificationPolicy: z.enum(ATTENDANCE_VERIFICATION_POLICY_VALUES).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, {
    message: "At least one setting must be provided.",
});

type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;

export const updateSettings = async (data: unknown, orgId: string) => {
    const parsed = UpdateSettingsInputSchema.safeParse(data);
    if (!parsed.success) {
        throw new AppError("Validation Failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const updateData: UpdateSettingsInput = parsed.data;

    const updated = await db
        .update(organization)
        .set({
            timezone: updateData.timezone,
            earlyClockInBufferMinutes: updateData.earlyClockInBufferMinutes,
            regionalOvertimePolicy: updateData.regionalOvertimePolicy,
            attendanceVerificationPolicy: updateData.attendanceVerificationPolicy as AttendanceVerificationPolicy | undefined,
        })
        .where(eq(organization.id, orgId))
        .returning();

    return updated[0];
};
