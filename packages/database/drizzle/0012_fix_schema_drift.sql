ALTER TABLE "location" ADD COLUMN IF NOT EXISTS "geocoded_at" timestamp;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN IF NOT EXISTS "geocode_source" text;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS "contact_id" text;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS "schedule_group_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "emergency_contact" json;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "address" json;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift" ADD CONSTRAINT "shift_contact_id_user_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
