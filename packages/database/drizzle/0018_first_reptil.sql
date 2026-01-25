CREATE TABLE IF NOT EXISTS "idempotency_key" (
	"key" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"hash" text NOT NULL,
	"response_data" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_limit_state" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" numeric(20, 0) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idempotency_org_idx" ON "idempotency_key" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_pos_idx" ON "location" USING gist ("position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "worker_location_pos_idx" ON "worker_location" USING gist ("position");