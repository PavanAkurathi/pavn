CREATE TABLE IF NOT EXISTS "device_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"push_token" text NOT NULL,
	"platform" text NOT NULL,
	"device_name" text,
	"app_version" text,
	"os_version" text,
	"is_active" boolean DEFAULT true,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"shift_id" text,
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb,
	"scheduled_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worker_notification_preferences" (
	"worker_id" text PRIMARY KEY NOT NULL,
	"night_before_enabled" boolean DEFAULT true,
	"sixty_min_enabled" boolean DEFAULT true,
	"fifteen_min_enabled" boolean DEFAULT true,
	"shift_start_enabled" boolean DEFAULT true,
	"late_warning_enabled" boolean DEFAULT true,
	"geofence_alerts_enabled" boolean DEFAULT true,
	"quiet_hours_enabled" boolean DEFAULT false,
	"quiet_hours_start" time,
	"quiet_hours_end" time,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_notification_preferences" ADD CONSTRAINT "worker_notification_preferences_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_device_tokens_unique" ON "device_tokens" USING btree ("user_id","push_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_device_tokens_user" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_pending_queue" ON "scheduled_notifications" USING btree ("scheduled_at","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_shift" ON "scheduled_notifications" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_worker" ON "scheduled_notifications" USING btree ("worker_id");