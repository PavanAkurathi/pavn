-- Invited in-house workers (roster entries without accounts yet) can be
-- assigned to shifts. When they accept their invite, assignments migrate to
-- their real user id.

ALTER TABLE "shift_assignment"
    ADD COLUMN IF NOT EXISTS "roster_entry_id" text REFERENCES "roster_entry"("id") ON DELETE RESTRICT;

ALTER TABLE "shift_assignment" DROP CONSTRAINT IF EXISTS "shift_assignment_worker_xor_temp";

ALTER TABLE "shift_assignment"
    ADD CONSTRAINT "shift_assignment_single_identity"
    CHECK (num_nonnulls("worker_id", "temp_worker_id", "roster_entry_id") = 1);
