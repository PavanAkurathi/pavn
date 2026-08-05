-- Temp (agency) workers: labor on a shift without an app account.
-- shift_assignment rows now reference exactly one of worker_id / temp_worker_id.

CREATE TABLE IF NOT EXISTS "temp_worker" (
    "id" text PRIMARY KEY NOT NULL,
    "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "agency" text,
    "phone" text,
    "notes" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "temp_worker_org_idx" ON "temp_worker" ("organization_id");

ALTER TABLE "shift_assignment" ALTER COLUMN "worker_id" DROP NOT NULL;

ALTER TABLE "shift_assignment"
    ADD COLUMN IF NOT EXISTS "temp_worker_id" text REFERENCES "temp_worker"("id") ON DELETE RESTRICT;

-- Exactly one identity per assignment.
ALTER TABLE "shift_assignment"
    ADD CONSTRAINT "shift_assignment_worker_xor_temp"
    CHECK (num_nonnulls("worker_id", "temp_worker_id") = 1);
