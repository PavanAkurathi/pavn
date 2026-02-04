ALTER TABLE "member" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "currency_code" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "timezone" text DEFAULT 'America/New_York' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "break_threshold_minutes" integer;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "regional_overtime_policy" text DEFAULT 'weekly_40' NOT NULL;