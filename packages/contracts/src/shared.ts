import { z } from "zod";

export const ATTENDANCE_VERIFICATION_POLICY_VALUES = [
    "strict_geofence",
    "soft_geofence",
    "none",
] as const;

export const AttendanceVerificationPolicySchema = z.enum(
    ATTENDANCE_VERIFICATION_POLICY_VALUES
);

export type AttendanceVerificationPolicy = z.infer<
    typeof AttendanceVerificationPolicySchema
>;
