-- One worker table. A worker belongs to the business that added them; roster_entry,
-- temp_worker and worker_role are folded into it, and every shift assignment now
-- points at worker.id (it used to point at a user, a temp, or a roster entry).
--
-- Hand-edited after `drizzle-kit generate`: the generated SQL created the table and
-- dropped the old ones but had no way to carry the data across.

CREATE TABLE "worker" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"phone_number" text,
	"email" text,
	"employment_type" text DEFAULT 'staff' NOT NULL,
	"agency" text,
	"job_title" text,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hourly_rate" integer,
	"notes" text,
	"invite_code" text,
	"status" text DEFAULT 'added' NOT NULL,
	"invited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worker_org_user_unique" UNIQUE("organization_id","user_id"),
	CONSTRAINT "check_worker_employment_type" CHECK ("worker"."employment_type" in ('staff', 'agency'))
);
--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "worker_org_idx" ON "worker" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "worker_user_idx" ON "worker" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "worker_org_phone_unique" ON "worker" USING btree ("organization_id","phone_number") WHERE "worker"."phone_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "worker_invite_code_unique" ON "worker" USING btree ("invite_code") WHERE "worker"."invite_code" is not null;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Carry the data over.
-- ---------------------------------------------------------------------------

-- Phone numbers: keep what is already E.164, give bare US numbers a +1.
-- (Helper objects are dropped again at the end.)
CREATE FUNCTION _e164(raw text) RETURNS text AS $$
	SELECT CASE
		WHEN raw IS NULL OR btrim(raw) = '' THEN NULL
		WHEN left(btrim(raw), 1) = '+' THEN '+' || regexp_replace(raw, '[^0-9]', '', 'g')
		WHEN length(regexp_replace(raw, '[^0-9]', '', 'g')) = 10 THEN '+1' || regexp_replace(raw, '[^0-9]', '', 'g')
		WHEN length(regexp_replace(raw, '[^0-9]', '', 'g')) = 11 AND left(regexp_replace(raw, '[^0-9]', '', 'g'), 1) = '1' THEN '+' || regexp_replace(raw, '[^0-9]', '', 'g')
		ELSE '+' || regexp_replace(raw, '[^0-9]', '', 'g')
	END
$$ LANGUAGE sql IMMUTABLE;--> statement-breakpoint

-- 1. In-house workers who already have an account: every member who is not staff.
INSERT INTO "worker" ("id", "organization_id", "user_id", "name", "phone_number", "email", "employment_type", "job_title", "roles", "hourly_rate", "status", "created_at", "updated_at")
SELECT
	'wkr_' || replace(gen_random_uuid()::text, '-', ''),
	m."organization_id",
	u."id",
	u."name",
	CASE WHEN row_number() OVER (PARTITION BY m."organization_id", _e164(u."phone_number") ORDER BY m."created_at") = 1
		THEN _e164(u."phone_number") END,
	lower(u."email"),
	'staff',
	m."job_title",
	COALESCE((
		SELECT jsonb_agg(wr."role" ORDER BY wr."created_at")
		FROM "worker_role" wr
		WHERE wr."worker_id" = u."id" AND wr."organization_id" = m."organization_id"
	), '[]'::jsonb),
	m."hourly_rate",
	CASE m."status" WHEN 'active' THEN 'active' WHEN 'invited' THEN 'invited' ELSE 'inactive' END,
	m."created_at",
	now()
FROM "member" m
JOIN "user" u ON u."id" = m."user_id"
WHERE m."role" NOT IN ('owner', 'admin', 'manager');--> statement-breakpoint

-- 2. Roster entries. One that matches a worker above (same business, same email or
--    phone) is the same person: it only fills in a missing phone and maps to it.
CREATE TABLE "_roster_worker_map" ("roster_id" text PRIMARY KEY, "worker_id" text NOT NULL);--> statement-breakpoint

INSERT INTO "_roster_worker_map" ("roster_id", "worker_id")
SELECT r."id", w."id"
FROM "roster_entry" r
JOIN LATERAL (
	SELECT w."id"
	FROM "worker" w
	WHERE w."organization_id" = r."organization_id"
		AND (lower(w."email") = lower(r."email")
			OR (_e164(r."phone_number") IS NOT NULL AND w."phone_number" = _e164(r."phone_number")))
	ORDER BY w."created_at"
	LIMIT 1
) w ON true;--> statement-breakpoint

UPDATE "worker" w
SET "phone_number" = _e164(r."phone_number")
FROM "roster_entry" r, "_roster_worker_map" mp
WHERE mp."roster_id" = r."id" AND mp."worker_id" = w."id"
	AND w."phone_number" IS NULL
	AND _e164(r."phone_number") IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM "worker" o
		WHERE o."organization_id" = w."organization_id" AND o."phone_number" = _e164(r."phone_number")
	);--> statement-breakpoint

INSERT INTO "worker" ("id", "organization_id", "user_id", "name", "phone_number", "email", "employment_type", "job_title", "roles", "hourly_rate", "status", "created_at", "updated_at")
SELECT
	r."id",
	r."organization_id",
	NULL,
	r."name",
	CASE WHEN row_number() OVER (PARTITION BY r."organization_id", _e164(r."phone_number") ORDER BY r."created_at") = 1
		AND NOT EXISTS (
			SELECT 1 FROM "worker" o
			WHERE o."organization_id" = r."organization_id" AND o."phone_number" = _e164(r."phone_number")
		)
		THEN _e164(r."phone_number") END,
	lower(r."email"),
	'staff',
	r."job_title",
	COALESCE(r."roles", '[]'::jsonb),
	r."hourly_rate",
	CASE r."status" WHEN 'invited' THEN 'invited' ELSE 'added' END,
	COALESCE(r."created_at", now()),
	now()
FROM "roster_entry" r
WHERE r."id" NOT IN (SELECT "roster_id" FROM "_roster_worker_map");--> statement-breakpoint

INSERT INTO "_roster_worker_map" ("roster_id", "worker_id")
SELECT r."id", r."id" FROM "roster_entry" r
WHERE r."id" NOT IN (SELECT "roster_id" FROM "_roster_worker_map");--> statement-breakpoint

-- 3. Agency temps keep their ids.
INSERT INTO "worker" ("id", "organization_id", "user_id", "name", "phone_number", "employment_type", "agency", "notes", "status", "created_at", "updated_at")
SELECT
	t."id",
	t."organization_id",
	NULL,
	t."name",
	CASE WHEN row_number() OVER (PARTITION BY t."organization_id", _e164(t."phone") ORDER BY t."created_at") = 1
		AND NOT EXISTS (
			SELECT 1 FROM "worker" o
			WHERE o."organization_id" = t."organization_id" AND o."phone_number" = _e164(t."phone")
		)
		THEN _e164(t."phone") END,
	'agency',
	t."agency",
	t."notes",
	'added',
	t."created_at",
	t."updated_at"
FROM "temp_worker" t;--> statement-breakpoint

-- 4. Anyone still assigned to a shift in a business that has no worker row for them
--    (a member who was removed, say) gets an inactive one, so no assignment is orphaned.
INSERT INTO "worker" ("id", "organization_id", "user_id", "name", "email", "employment_type", "status", "created_at", "updated_at")
SELECT DISTINCT ON (s."organization_id", sa."worker_id")
	'wkr_' || replace(gen_random_uuid()::text, '-', ''),
	s."organization_id",
	u."id",
	u."name",
	lower(u."email"),
	'staff',
	'inactive',
	now(),
	now()
FROM "shift_assignment" sa
JOIN "shift" s ON s."id" = sa."shift_id"
JOIN "user" u ON u."id" = sa."worker_id"
WHERE sa."worker_id" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM "worker" w
		WHERE w."organization_id" = s."organization_id" AND w."user_id" = sa."worker_id"
	);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Re-point the assignments.
-- ---------------------------------------------------------------------------

ALTER TABLE "shift_assignment" ADD COLUMN "worker_ref" text;--> statement-breakpoint

UPDATE "shift_assignment" sa
SET "worker_ref" = w."id"
FROM "shift" s, "worker" w
WHERE sa."worker_id" IS NOT NULL
	AND s."id" = sa."shift_id"
	AND w."organization_id" = s."organization_id"
	AND w."user_id" = sa."worker_id";--> statement-breakpoint

UPDATE "shift_assignment" SET "worker_ref" = "temp_worker_id" WHERE "temp_worker_id" IS NOT NULL;--> statement-breakpoint

UPDATE "shift_assignment" sa
SET "worker_ref" = mp."worker_id"
FROM "_roster_worker_map" mp
WHERE sa."roster_entry_id" = mp."roster_id";--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "shift_assignment" WHERE "worker_ref" IS NULL) THEN
		RAISE EXCEPTION 'worker migration: some shift assignments could not be mapped to a worker';
	END IF;
END $$;--> statement-breakpoint

ALTER TABLE "shift_assignment" DROP CONSTRAINT "shift_assignment_single_identity";--> statement-breakpoint
-- Dropping the old columns takes their foreign keys, index and the
-- (shift, worker) unique constraint with them; they come back below.
ALTER TABLE "shift_assignment" DROP COLUMN "worker_id";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN "temp_worker_id";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN "roster_entry_id";--> statement-breakpoint
ALTER TABLE "shift_assignment" RENAME COLUMN "worker_ref" TO "worker_id";--> statement-breakpoint
ALTER TABLE "shift_assignment" ALTER COLUMN "worker_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignment_worker_idx" ON "shift_assignment" USING btree ("worker_id");--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD CONSTRAINT "unique_worker_shift" UNIQUE("shift_id","worker_id");--> statement-breakpoint

-- Workers used to be invited through the business invitation table (by email).
-- They join by phone now, so any still-open worker invitation can no longer be
-- accepted. Manager and admin invitations are untouched.
UPDATE "invitation" SET "status" = 'canceled'
WHERE "status" = 'pending' AND coalesce("role", 'member') NOT IN ('owner', 'admin', 'manager');--> statement-breakpoint

DROP TABLE "_roster_worker_map";--> statement-breakpoint
DROP FUNCTION _e164(text);--> statement-breakpoint
DROP TABLE "roster_entry" CASCADE;--> statement-breakpoint
DROP TABLE "temp_worker" CASCADE;--> statement-breakpoint
DROP TABLE "worker_role" CASCADE;
