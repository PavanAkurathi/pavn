ALTER TABLE "shift_assignment" RENAME COLUMN "user_id" TO "worker_id";

ALTER TABLE "shift_assignment" DROP CONSTRAINT "shift_assignment_user_id_user_id_fk";

DO $$ BEGIN
 ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_worker_id_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DROP INDEX IF EXISTS "assignment_worker_idx";
CREATE INDEX IF NOT EXISTS "assignment_worker_idx" ON "shift_assignment" USING btree ("worker_id");

ALTER TABLE "shift_assignment" DROP CONSTRAINT IF EXISTS "unique_worker_shift";
ALTER TABLE "shift_assignment" ADD CONSTRAINT "unique_worker_shift" UNIQUE("shift_id","worker_id");