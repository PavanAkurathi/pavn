CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"expires_at" timestamp,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" text,
	"title" text NOT NULL,
	"description" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"capacity_total" integer DEFAULT 1 NOT NULL,
	"price" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"shift_id" text NOT NULL,
	"user_id" text NOT NULL,
	"clock_in" timestamp,
	"clock_out" timestamp,
	"break_minutes" integer DEFAULT 0,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_worker_shift" UNIQUE("shift_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN IF NOT EXISTS "zip" text;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN IF NOT EXISTS "parking" text DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN IF NOT EXISTS "specifics" json;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN IF NOT EXISTS "instructions" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "subscription_status" text DEFAULT 'inactive';--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "current_period_end" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift" ADD CONSTRAINT "shift_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift" ADD CONSTRAINT "shift_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_org_idx" ON "shift" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_status_idx" ON "shift" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_time_idx" ON "shift" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignment_shift_idx" ON "shift_assignment" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignment_worker_idx" ON "shift_assignment" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "password";