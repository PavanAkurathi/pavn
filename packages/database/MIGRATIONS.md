# Database Migrations Status

## Schema Drift Fix (January 2026)

We identified a schema drift where `drizzle-kit` believed certain tables (`worker_location`, `time_correction_request`) and columns (in `shift_assignment`) existed, but the corresponding SQL migration files were missing.

To resolve this, we performed a forced synchronization:
1.  **Migration 0006**: Generated a `DROP` migration (by temporarily removing schema definitions) to align Drizzle's internal state with the (assumed) production state of missing tables. *This migration is a safe no-op if the tables truly don't exist.*
2.  **Migration 0007**: Generated a `CREATE` migration (by restoring schema definitions) to properly generate the missing SQL statements.

**Action Required:**
Run `bun run migrate` (or `drizzle-kit migrate`) to apply these changes.
- If your database **does not** have these tables, `0006` will do nothing (or fail safely if you use `migrate`), and `0007` will create them.
- If your database **does** have these tables (unexpected), `0006` will drop them (DATA LOSS RISK) and `0007` will recreate empty ones. **Verify your production DB first.**

> If you are sure your production DB does NOT have these tables, just run the migrations.

## Remove Currency Field (WH-002)

To clean up schema drift, we removed the orphaned `currency` field from the `shift` table.
- **Migration 0009**: Adds composite indexes to `shift` and status index to `shift_assignment`.

## Add Missing Indexes (WH-006)

To improve query performance for common filtering patterns (by Organization and Status), we added new database indexes.
- **Migration 0009**: Adds composite indexes to `shift` and status index to `shift_assignment`.


