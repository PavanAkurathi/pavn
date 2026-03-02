CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"expires_at" timestamp with time zone,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_id" text,
	"user_name" text,
	"ip_address" text,
	"user_agent" text,
	"changes" json,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certification" (
	"id" text PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"name" text NOT NULL,
	"issuer" text,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'valid',
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
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
CREATE TABLE "idempotency_key" (
	"key" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"hash" text NOT NULL,
	"response_data" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"address" text,
	"zip" text,
	"parking" text DEFAULT 'free',
	"specifics" json,
	"instructions" text,
	"position" jsonb,
	"geofence_radius" integer DEFAULT 100,
	"geocoded_at" timestamp with time zone,
	"geocode_source" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manager_notification_preferences" (
	"manager_id" text PRIMARY KEY NOT NULL,
	"clock_in_alerts_enabled" boolean DEFAULT true,
	"clock_out_alerts_enabled" boolean DEFAULT true,
	"shift_scope" text DEFAULT 'all' NOT NULL,
	"location_scope" text DEFAULT 'all' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"hourly_rate" integer,
	"job_title" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_org_user_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"created_at" timestamp with time zone NOT NULL,
	"metadata" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text DEFAULT 'inactive',
	"current_period_end" timestamp with time zone,
	"early_clock_in_buffer_minutes" integer DEFAULT 60 NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"break_threshold_minutes" integer,
	"regional_overtime_policy" text DEFAULT 'weekly_40' NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_state" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" numeric(20, 0) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone_number" text,
	"role" text DEFAULT 'member',
	"hourly_rate" integer,
	"job_title" text,
	"status" text DEFAULT 'uninvited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scheduled_notifications" (
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
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"activeOrganizationId" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shift" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" text,
	"contact_id" text,
	"title" text NOT NULL,
	"description" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"capacity_total" integer DEFAULT 1 NOT NULL,
	"price" integer DEFAULT 0,
	"status" text DEFAULT 'published' NOT NULL,
	"schedule_group_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"shift_id" text NOT NULL,
	"worker_id" text NOT NULL,
	"actual_clock_in" timestamp,
	"actual_clock_out" timestamp,
	"effective_clock_in" timestamp,
	"effective_clock_out" timestamp,
	"manager_verified_in" timestamp,
	"manager_verified_out" timestamp,
	"break_minutes" integer DEFAULT 0,
	"budget_rate_snapshot" integer,
	"payout_amount_cents" bigint,
	"total_duration_minutes" integer DEFAULT 0,
	"clock_in_position" jsonb,
	"clock_in_verified" boolean DEFAULT false,
	"clock_in_method" text,
	"clock_out_position" jsonb,
	"clock_out_verified" boolean DEFAULT false,
	"clock_out_method" text,
	"needs_review" boolean DEFAULT false,
	"review_reason" text,
	"last_known_position" jsonb,
	"last_known_at" timestamp with time zone,
	"adjusted_by" text,
	"adjusted_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_worker_shift" UNIQUE("shift_id","worker_id")
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"reference_id" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"status" text,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"cancel_at_period_end" boolean,
	"cancel_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"seats" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_correction_request" (
	"id" text PRIMARY KEY NOT NULL,
	"shift_assignment_id" text NOT NULL,
	"worker_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"requested_clock_in" timestamp with time zone,
	"requested_clock_out" timestamp with time zone,
	"requested_break_minutes" integer,
	"original_clock_in" timestamp with time zone,
	"original_clock_out" timestamp with time zone,
	"original_break_minutes" integer,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"phone_number" text,
	"stripe_customer_id" text,
	"emergency_contact" json,
	"address" json,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "worker_availability" (
	"id" text PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"type" text DEFAULT 'unavailable' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_location" (
	"id" text PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"shift_id" text,
	"organization_id" text NOT NULL,
	"position" jsonb NOT NULL,
	"accuracy_meters" integer,
	"venue_position" jsonb,
	"distance_to_venue_meters" integer,
	"is_on_site" boolean DEFAULT false,
	"event_type" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_timestamp" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "worker_notification_preferences" (
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
CREATE TABLE "worker_role" (
	"id" text PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"hourly_rate" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certification" ADD CONSTRAINT "certification_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_notification_preferences" ADD CONSTRAINT "manager_notification_preferences_manager_id_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entry" ADD CONSTRAINT "roster_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_contact_id_user_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_adjusted_by_user_id_fk" FOREIGN KEY ("adjusted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_correction_request" ADD CONSTRAINT "time_correction_request_shift_assignment_id_shift_assignment_id_fk" FOREIGN KEY ("shift_assignment_id") REFERENCES "public"."shift_assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_correction_request" ADD CONSTRAINT "time_correction_request_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_correction_request" ADD CONSTRAINT "time_correction_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_correction_request" ADD CONSTRAINT "time_correction_request_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_availability" ADD CONSTRAINT "worker_availability_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_location" ADD CONSTRAINT "worker_location_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_location" ADD CONSTRAINT "worker_location_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_location" ADD CONSTRAINT "worker_location_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_notification_preferences" ADD CONSTRAINT "worker_notification_preferences_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_role" ADD CONSTRAINT "worker_role_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_role" ADD CONSTRAINT "worker_role_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "audit_assignment_idx" ON "assignment_audit_events" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "audit_timestamp_idx" ON "assignment_audit_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_time_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cert_worker_idx" ON "certification" USING btree ("worker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_device_tokens_unique" ON "device_tokens" USING btree ("user_id","push_token");--> statement-breakpoint
CREATE INDEX "idx_device_tokens_user" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idempotency_org_idx" ON "idempotency_key" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "location_org_idx" ON "location" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "location_pos_idx" ON "location" USING btree ("position");--> statement-breakpoint
CREATE INDEX "member_org_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_user_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_pending_queue" ON "scheduled_notifications" USING btree ("scheduled_at","status");--> statement-breakpoint
CREATE INDEX "idx_notifications_shift" ON "scheduled_notifications" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_worker" ON "scheduled_notifications" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_org" ON "scheduled_notifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shift_org_idx" ON "shift" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "shift_status_idx" ON "shift" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shift_time_idx" ON "shift" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "shift_org_status_idx" ON "shift" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "shift_org_time_idx" ON "shift" USING btree ("organization_id","start_time");--> statement-breakpoint
CREATE INDEX "shift_status_time_idx" ON "shift" USING btree ("status","start_time") WHERE status IN ('published', 'assigned', 'in-progress');--> statement-breakpoint
CREATE INDEX "shift_location_idx" ON "shift" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "assignment_shift_idx" ON "shift_assignment" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "assignment_worker_idx" ON "shift_assignment" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "assignment_status_idx" ON "shift_assignment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "correction_assignment_idx" ON "time_correction_request" USING btree ("shift_assignment_id");--> statement-breakpoint
CREATE INDEX "correction_worker_idx" ON "time_correction_request" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "correction_status_idx" ON "time_correction_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "correction_org_idx" ON "time_correction_request" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "avail_worker_idx" ON "worker_availability" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "avail_time_idx" ON "worker_availability" USING btree ("start_time","end_time");--> statement-breakpoint
CREATE INDEX "worker_location_worker_idx" ON "worker_location" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "worker_location_shift_idx" ON "worker_location" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "worker_location_time_idx" ON "worker_location" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "worker_location_org_idx" ON "worker_location" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "worker_location_pos_idx" ON "worker_location" USING btree ("position");--> statement-breakpoint
CREATE INDEX "worker_role_worker_idx" ON "worker_role" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "worker_role_org_idx" ON "worker_role" USING btree ("organization_id");