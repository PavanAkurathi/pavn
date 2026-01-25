CREATE TABLE IF NOT EXISTS "manager_notification_preferences" (
	"manager_id" text PRIMARY KEY NOT NULL,
	"clock_in_alerts_enabled" boolean DEFAULT true,
	"clock_out_alerts_enabled" boolean DEFAULT true,
	"shift_scope" text DEFAULT 'all' NOT NULL,
	"location_scope" text DEFAULT 'all' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "manager_notification_preferences" ADD CONSTRAINT "manager_notification_preferences_manager_id_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
