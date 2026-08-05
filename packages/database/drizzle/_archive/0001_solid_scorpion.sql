CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "location_pos_idx";--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS "timezone" text;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN IF NOT EXISTS "clock_in_accuracy" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN IF NOT EXISTS "clock_in_distance" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN IF NOT EXISTS "clock_in_warning" text;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN IF NOT EXISTS "clock_out_accuracy" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN IF NOT EXISTS "clock_out_distance" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'admin';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'UTC';--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "location_position_gist_idx"
ON "location"
USING gist (((ST_SetSRID(
    ST_MakePoint(
        (("position" ->> 'lng')::double precision),
        (("position" ->> 'lat')::double precision)
    ),
    4326
))::geography));--> statement-breakpoint
UPDATE "location"
SET "geofence_radius" = CASE
    WHEN "geofence_radius" IS NULL THEN 100
    WHEN "geofence_radius" < 10 THEN 10
    WHEN "geofence_radius" > 500 THEN 500
    ELSE "geofence_radius"
END
WHERE "geofence_radius" IS NULL
   OR "geofence_radius" < 10
   OR "geofence_radius" > 500;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'check_geofence_radius_range'
    ) THEN
        ALTER TABLE "location"
        ADD CONSTRAINT "check_geofence_radius_range"
        CHECK ("location"."geofence_radius" >= 10 AND "location"."geofence_radius" <= 500);
    END IF;
END $$;
