CREATE TABLE IF NOT EXISTS "time_correction_request" (
	"id" text PRIMARY KEY NOT NULL,
	"shift_assignment_id" text NOT NULL,
	"worker_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"requested_clock_in" timestamp,
	"requested_clock_out" timestamp,
	"requested_break_minutes" integer,
	"original_clock_in" timestamp,
	"original_clock_out" timestamp,
	"original_break_minutes" integer,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worker_location" (
	"id" text PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"shift_id" text,
	"organization_id" text NOT NULL,
	"latitude" text NOT NULL,
	"longitude" text NOT NULL,
	"accuracy_meters" integer,
	"venue_latitude" text,
	"venue_longitude" text,
	"distance_to_venue_meters" integer,
	"is_on_site" boolean DEFAULT false,
	"event_type" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"device_timestamp" timestamp
);
--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "hourly_rate_snapshot" integer;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "gross_pay_cents" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "clock_in_latitude" text;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "clock_in_longitude" text;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "clock_in_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "clock_in_method" text;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "clock_out_latitude" text;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "clock_out_longitude" text;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "clock_out_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "clock_out_method" text;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "needs_review" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "last_known_latitude" text;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "last_known_longitude" text;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "last_known_at" timestamp;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "adjusted_by" text;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "adjusted_at" timestamp;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "adjustment_notes" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "time_correction_request" ADD CONSTRAINT "time_correction_request_shift_assignment_id_shift_assignment_id_fk" FOREIGN KEY ("shift_assignment_id") REFERENCES "public"."shift_assignment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "time_correction_request" ADD CONSTRAINT "time_correction_request_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "time_correction_request" ADD CONSTRAINT "time_correction_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "time_correction_request" ADD CONSTRAINT "time_correction_request_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_location" ADD CONSTRAINT "worker_location_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_location" ADD CONSTRAINT "worker_location_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_location" ADD CONSTRAINT "worker_location_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correction_assignment_idx" ON "time_correction_request" USING btree ("shift_assignment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correction_worker_idx" ON "time_correction_request" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correction_status_idx" ON "time_correction_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correction_org_idx" ON "time_correction_request" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "worker_location_worker_idx" ON "worker_location" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "worker_location_shift_idx" ON "worker_location" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "worker_location_time_idx" ON "worker_location" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "worker_location_org_idx" ON "worker_location" USING btree ("organization_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_adjusted_by_user_id_fk" FOREIGN KEY ("adjusted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
