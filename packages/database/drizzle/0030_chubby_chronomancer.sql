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
ALTER TABLE "worker_role" ADD CONSTRAINT "worker_role_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_role" ADD CONSTRAINT "worker_role_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "worker_role_worker_idx" ON "worker_role" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "worker_role_org_idx" ON "worker_role" USING btree ("organization_id");