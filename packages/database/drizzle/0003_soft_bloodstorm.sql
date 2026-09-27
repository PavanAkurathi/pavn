CREATE TABLE "department" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "department_org_name" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "schedule_event" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"name" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_schedule_event_time" CHECK ("schedule_event"."end_time" > "schedule_event"."start_time")
);
--> statement-breakpoint
CREATE TABLE "shift_request" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"shift_id" text NOT NULL,
	"requester_worker_id" text NOT NULL,
	"target_worker_id" text,
	"status" text DEFAULT 'pending_manager' NOT NULL,
	"note" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_shift_request_type" CHECK ("shift_request"."type" in ('claim', 'drop', 'swap')),
	CONSTRAINT "check_shift_request_status" CHECK ("shift_request"."status" in ('pending_peer', 'pending_manager', 'approved', 'declined', 'cancelled', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "time_off_request" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"worker_id" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"manager_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_time_off_status" CHECK ("time_off_request"."status" in ('pending', 'approved', 'declined', 'cancelled')),
	CONSTRAINT "check_time_off_time" CHECK ("time_off_request"."end_time" > "time_off_request"."start_time")
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "week_starts_on" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "open_shift_claim_policy" text DEFAULT 'approval' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "swap_approval_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "business_type" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "schedule_style" text DEFAULT 'steady' NOT NULL;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN "break_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN "event_id" text;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN "pending_patch" jsonb;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN "manager_note" text;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "pending_state" text;--> statement-breakpoint
ALTER TABLE "department" ADD CONSTRAINT "department_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_event" ADD CONSTRAINT "schedule_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_event" ADD CONSTRAINT "schedule_event_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_event" ADD CONSTRAINT "schedule_event_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_request" ADD CONSTRAINT "shift_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_request" ADD CONSTRAINT "shift_request_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_request" ADD CONSTRAINT "shift_request_requester_worker_id_user_id_fk" FOREIGN KEY ("requester_worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_request" ADD CONSTRAINT "shift_request_target_worker_id_user_id_fk" FOREIGN KEY ("target_worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_request" ADD CONSTRAINT "shift_request_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_request" ADD CONSTRAINT "time_off_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_request" ADD CONSTRAINT "time_off_request_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_request" ADD CONSTRAINT "time_off_request_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "department_org_idx" ON "department" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "schedule_event_org_idx" ON "schedule_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "schedule_event_location_time_idx" ON "schedule_event" USING btree ("location_id","start_time");--> statement-breakpoint
CREATE INDEX "shift_request_org_status_idx" ON "shift_request" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "shift_request_shift_idx" ON "shift_request" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_request_one_open_idx" ON "shift_request" USING btree ("shift_id","requester_worker_id","type") WHERE status in ('pending_peer', 'pending_manager');--> statement-breakpoint
CREATE INDEX "time_off_org_status_idx" ON "time_off_request" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "time_off_worker_time_idx" ON "time_off_request" USING btree ("worker_id","start_time");--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_event_id_schedule_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."schedule_event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shift_event_idx" ON "shift" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "check_week_starts_on" CHECK ("organization"."week_starts_on" between 0 and 6);--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "check_open_shift_claim_policy" CHECK ("organization"."open_shift_claim_policy" in ('approval', 'auto'));--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "check_business_type" CHECK ("organization"."business_type" is null or "organization"."business_type" in ('restaurant', 'retail', 'events', 'other'));--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "check_schedule_style" CHECK ("organization"."schedule_style" in ('steady', 'events'));--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD CONSTRAINT "check_assignment_pending_state" CHECK ("shift_assignment"."pending_state" is null or "shift_assignment"."pending_state" in ('add', 'remove'));