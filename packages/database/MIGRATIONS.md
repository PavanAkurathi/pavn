# Database Migrations

## Current state

`drizzle/` holds a **single `0000_baseline`** migration, squashed on 2026-08-07
from the old `0000`–`0012` history. Production's `drizzle.__drizzle_migrations`
holds the one matching row. `db:generate` against a clean tree is a no-op, and
`.github/workflows/schema-drift.yml` is blocking (`exit 1`) again.

The baseline was verified, not assumed. It was applied to an empty database via
`drizzle-kit migrate` (exit 0) and the result fingerprinted against production:

| | fingerprint | count |
|---|---|---|
| tables | `9e69dc4c` | 26 |
| columns | `24443ff5` | 315 |
| indexes | `405c245a` | 79 |
| constraints | `6f3f7c5c` | 71 |

All four match production exactly.

## What was wrong before

Production's schema was always correct and complete — only the bookkeeping had
diverged. `__drizzle_migrations` held 4 rows, `_journal.json` listed 5, and 8 SQL
files existed, because `0004`/`0010`/`0011`/`0012` were applied out of band. Only
2 snapshots existed for 5 journal entries, so `drizzle-kit` diffed `schema.ts`
against `0001` and re-emitted everything from `0002` on.

Migrations had to be run by hand because a from-scratch rebuild was impossible
for three independent reasons, each fixed in the squash:

1. **`CREATE INDEX CONCURRENTLY`** — `location_position_gist_idx` was declared
   `.concurrently()`. That is illegal inside a transaction and `drizzle-kit` wraps
   every migration in one, so `db:migrate` could never apply it. `location` is
   small, so `schema.ts` now declares a plain index; build it concurrently by hand
   if it ever needs adding to a large live table.
2. **`(expr)::geography`** — Postgres only lets an expression index omit
   surrounding parentheses when the expression is a plain function call. A cast
   needs its own layer, so `jsonPositionToGeography` now emits
   `((expr)::geography)`.
3. **No PostGIS** — nothing ever created the extension. The baseline now opens
   with `CREATE EXTENSION IF NOT EXISTS postgis`.

Two things production had that `schema.ts` did not, now declared:

- `shift_assignment_single_identity`, the XOR check that exactly one of
  `worker_id` / `temp_worker_id` / `roster_entry_id` is set. It existed only
  because hand-written `0012` added it, so a generated environment silently lost
  it.
- Three foreign keys carried Postgres' default `_fkey` names (from the same
  hand-written SQL) instead of drizzle's convention. Production was renamed to
  match; the columns, references and `ON DELETE` behaviour were already identical.

## If you need to undo it

`scripts/ROLLBACK-2026-08-07-baseline-squash.sql` restores the old ledger rows and
reverts the three constraint renames. It touches bookkeeping and names only — no
table data. The pre-squash migration files are in git history at `6f8cbf9`.

## Rules

**Never hand-apply migrations again.** The whole reason the journal diverged was
out-of-band SQL. If `db:migrate` can't apply something, fix the generator or the
schema rather than reaching for `psql`.

**Never edit `0000_baseline.sql` or its snapshot.** Change `schema.ts` and run
`db:generate`, which will emit `0001` onward.

If you ever regenerate the baseline from scratch, re-add the
`CREATE EXTENSION IF NOT EXISTS postgis` line — `drizzle-kit` does not emit it.

## Commands

```bash
bun run --filter @repo/database db:generate   # generate a migration from schema.ts
bun run --filter @repo/database db:migrate    # apply pending migrations
bun run --filter @repo/database db:studio     # browse the database
```

Database-backed tests (`exploration-*`, `preservation-*`) need `DATABASE_URL` and
only run with `RUN_DB_TESTS=true`.
