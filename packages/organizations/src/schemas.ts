import { z } from "zod";
import { ATTENDANCE_VERIFICATION_POLICY_VALUES } from "@repo/config";

export const LocationSchema = z.object({
    id: z.string(),
    name: z.string(),
    address: z.string(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    radius: z.number().optional(),
});

export const createLocationSchema = z.object({
    name: z.string().min(1).max(200),
    address: z.string().min(5).max(500),
    timezone: z.string().optional().default("UTC"),
    geofenceRadius: z.number().min(50).max(1000).optional().default(150),
    geofenceRadiusMeters: z.number().optional(),
});

export const AttendanceVerificationPolicySchema = z.enum(
    ATTENDANCE_VERIFICATION_POLICY_VALUES
);

export const UpdateOrganizationSettingsSchema = z.object({
    timezone: z.string().optional(),
    earlyClockInBufferMinutes: z.number().int().min(0).max(720).optional(),
    regionalOvertimePolicy: z.enum(["weekly_40", "daily_8"]).optional(),
    attendanceVerificationPolicy: AttendanceVerificationPolicySchema.optional(),
});

export const OrganizationSettingsSchema = z.object({
    name: z.string(),
    slug: z.string().nullable().optional(),
    timezone: z.string(),
    currencyCode: z.string(),
    attendanceVerificationPolicy: AttendanceVerificationPolicySchema,
    excessParameters: z.object({
        earlyClockInBufferMinutes: z.number().int(),
        breakThresholdMinutes: z.number().int().nullable().optional(),
        regionalOvertimePolicy: z.string(),
    }),
});
