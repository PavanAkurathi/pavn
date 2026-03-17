export const ATTENDANCE_VERIFICATION_POLICY_VALUES = [
    "strict_geofence",
    "soft_geofence",
    "none",
] as const;

export type AttendanceVerificationPolicy =
    (typeof ATTENDANCE_VERIFICATION_POLICY_VALUES)[number];

export const DEFAULT_ATTENDANCE_VERIFICATION_POLICY: AttendanceVerificationPolicy =
    "strict_geofence";
