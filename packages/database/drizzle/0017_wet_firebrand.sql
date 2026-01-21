CREATE EXTENSION IF NOT EXISTS "postgis";--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "position" geography(POINT, 4326);--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "clock_in_position" geography(POINT, 4326);--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "clock_out_position" geography(POINT, 4326);--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "last_known_position" geography(POINT, 4326);--> statement-breakpoint
ALTER TABLE "worker_location" ADD COLUMN "position" geography(POINT, 4326) NOT NULL;--> statement-breakpoint
ALTER TABLE "worker_location" ADD COLUMN "venue_position" geography(POINT, 4326);--> statement-breakpoint
ALTER TABLE "location" DROP COLUMN IF EXISTS "latitude";--> statement-breakpoint
ALTER TABLE "location" DROP COLUMN IF EXISTS "longitude";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "clock_in_latitude";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "clock_in_longitude";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "clock_out_latitude";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "clock_out_longitude";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "last_known_latitude";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "last_known_longitude";--> statement-breakpoint
ALTER TABLE "worker_location" DROP COLUMN IF EXISTS "latitude";--> statement-breakpoint
ALTER TABLE "worker_location" DROP COLUMN IF EXISTS "longitude";--> statement-breakpoint
ALTER TABLE "worker_location" DROP COLUMN IF EXISTS "venue_latitude";--> statement-breakpoint
ALTER TABLE "worker_location" DROP COLUMN IF EXISTS "venue_longitude";