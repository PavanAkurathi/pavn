ALTER TABLE "shift_assignment" ALTER COLUMN "clock_in_latitude" SET DATA TYPE numeric(10, 8) USING NULLIF("clock_in_latitude", '')::numeric(10, 8);--> statement-breakpoint
ALTER TABLE "shift_assignment" ALTER COLUMN "clock_in_longitude" SET DATA TYPE numeric(11, 8) USING NULLIF("clock_in_longitude", '')::numeric(11, 8);--> statement-breakpoint
ALTER TABLE "shift_assignment" ALTER COLUMN "clock_out_latitude" SET DATA TYPE numeric(10, 8) USING NULLIF("clock_out_latitude", '')::numeric(10, 8);--> statement-breakpoint
ALTER TABLE "shift_assignment" ALTER COLUMN "clock_out_longitude" SET DATA TYPE numeric(11, 8) USING NULLIF("clock_out_longitude", '')::numeric(11, 8);--> statement-breakpoint
ALTER TABLE "shift_assignment" ALTER COLUMN "last_known_latitude" SET DATA TYPE numeric(10, 8) USING NULLIF("last_known_latitude", '')::numeric(10, 8);--> statement-breakpoint
ALTER TABLE "shift_assignment" ALTER COLUMN "last_known_longitude" SET DATA TYPE numeric(11, 8) USING NULLIF("last_known_longitude", '')::numeric(11, 8);--> statement-breakpoint
ALTER TABLE "worker_location" ALTER COLUMN "latitude" SET DATA TYPE numeric(10, 8) USING "latitude"::numeric(10, 8);--> statement-breakpoint
ALTER TABLE "worker_location" ALTER COLUMN "longitude" SET DATA TYPE numeric(11, 8) USING "longitude"::numeric(11, 8);--> statement-breakpoint
ALTER TABLE "worker_location" ALTER COLUMN "venue_latitude" SET DATA TYPE numeric(10, 8) USING NULLIF("venue_latitude", '')::numeric(10, 8);--> statement-breakpoint
ALTER TABLE "worker_location" ALTER COLUMN "venue_longitude" SET DATA TYPE numeric(11, 8) USING NULLIF("venue_longitude", '')::numeric(11, 8);