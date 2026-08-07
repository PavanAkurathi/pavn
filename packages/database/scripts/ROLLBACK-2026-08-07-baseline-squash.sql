-- Rollback for the 2026-08-07 baseline-squash reconciliation.
-- Restores drizzle.__drizzle_migrations to its pre-reconciliation state
-- and reverts the three FK constraint renames. Schema data is untouched.

BEGIN;
DELETE FROM drizzle.__drizzle_migrations;
INSERT INTO drizzle.__drizzle_migrations (id, hash, created_at) VALUES
  (1,'06f801e1bf8f928e505639679c62758cfe5fa7e4a05e0b58b6059aa2581ba979',1772390501000),
  (2,'41c5a6bc78a804e40b2c5ddb98c638d6b301048ded0de3b7a109365698a76aa3',1773124658000),
  (3,'db5b3eb765d207c21fa6efcdaa69ad86e39654c8bdd7c548fa32f716a4b1c3e6',1773201600000),
  (4,'07191ab1b393091a4b986bc8ef512f14e259de06e76d1818deace3cd03ec8d9e',1773381000000);

ALTER TABLE shift_assignment RENAME CONSTRAINT shift_assignment_roster_entry_id_roster_entry_id_fk TO shift_assignment_roster_entry_id_fkey;
ALTER TABLE shift_assignment RENAME CONSTRAINT shift_assignment_temp_worker_id_temp_worker_id_fk TO shift_assignment_temp_worker_id_fkey;
ALTER TABLE temp_worker RENAME CONSTRAINT temp_worker_organization_id_organization_id_fk TO temp_worker_organization_id_fkey;
COMMIT;
