CREATE TABLE IF NOT EXISTS "worker_availability" (
	"id" text PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"type" text DEFAULT 'unavailable' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_availability" ADD CONSTRAINT "worker_availability_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "avail_worker_idx" ON "worker_availability" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "avail_time_idx" ON "worker_availability" USING btree ("start_time","end_time");