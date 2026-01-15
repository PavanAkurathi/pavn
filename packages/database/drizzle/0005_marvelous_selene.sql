CREATE TABLE IF NOT EXISTS "certification" (
	"id" text PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"name" text NOT NULL,
	"issuer" text,
	"expires_at" timestamp,
	"status" text DEFAULT 'valid',
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "location" RENAME COLUMN "geofence_radius_meters" TO "geofence_radius";--> statement-breakpoint
ALTER TABLE "location" ALTER COLUMN "latitude" SET DATA TYPE numeric(10, 8) USING latitude::numeric(10, 8);--> statement-breakpoint
ALTER TABLE "location" ALTER COLUMN "longitude" SET DATA TYPE numeric(11, 8) USING longitude::numeric(11, 8);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "certification" ADD CONSTRAINT "certification_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cert_worker_idx" ON "certification" USING btree ("worker_id");