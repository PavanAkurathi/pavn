-- TENANT-001: Add organizationId to worker_availability for tenant isolation
-- This prevents cross-tenant availability data leaks during shift publishing.
--
-- Migration Strategy (safe for existing data):
--   1. Add column as NULLABLE first
--   2. Backfill from member table (worker → org mapping)
--   3. Set NOT NULL constraint
--   4. Add foreign key and index

-- Step 1: Add nullable column
ALTER TABLE "worker_availability"
ADD COLUMN IF NOT EXISTS "organization_id" text;

-- Step 2: Backfill organization_id from the member table
-- Each worker's availability gets the org they belong to.
-- If a worker is in multiple orgs, we pick the first membership (rare edge case for V1).
UPDATE "worker_availability" wa
SET "organization_id" = (
    SELECT m."organization_id"
    FROM "member" m
    WHERE m."user_id" = wa."worker_id"
    LIMIT 1
)
WHERE wa."organization_id" IS NULL;

-- Step 3: Delete orphaned rows where no membership exists (cleanup)
DELETE FROM "worker_availability"
WHERE "organization_id" IS NULL;

-- Step 4: Set NOT NULL constraint
ALTER TABLE "worker_availability"
ALTER COLUMN "organization_id" SET NOT NULL;

-- Step 5: Add foreign key reference to organization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'worker_availability_organization_id_organization_id_fk'
    ) THEN
        ALTER TABLE "worker_availability"
        ADD CONSTRAINT "worker_availability_organization_id_organization_id_fk"
        FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- Step 6: Add index for org-scoped queries
CREATE INDEX IF NOT EXISTS "avail_org_idx" ON "worker_availability" ("organization_id");
