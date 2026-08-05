ALTER TABLE "organization"
ADD COLUMN IF NOT EXISTS "attendance_verification_policy" text NOT NULL DEFAULT 'strict_geofence';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'check_attendance_verification_policy'
    ) THEN
        ALTER TABLE "organization"
        ADD CONSTRAINT "check_attendance_verification_policy"
        CHECK ("attendance_verification_policy" in ('strict_geofence', 'soft_geofence', 'none'));
    END IF;
END $$;
