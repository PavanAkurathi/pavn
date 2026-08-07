# Database Migrations

> The previous contents of this file described migrations `0006`–`0009` that have
> never existed on disk, and told you to run a drop/recreate sequence flagged
> "DATA LOSS RISK". Following it would have been actively harmful. Replaced with
> the state verified against production on 2026-08-05.

## Current state

**The production schema is correct and complete.** What diverged is the migration
bookkeeping, not the database:

- `drizzle.__drizzle_migrations` holds **4 rows** (`0000`–`0003`, applied Mar 2026).
- `drizzle/meta/_journal.json` lists **5** entries.
- **8** migration SQL files exist on disk.

`0004`, `0010`, `0011` and `0012` were applied out of band — by hand or via
`scripts/apply-manual-migrations.ts` — and never recorded. Separately, only **2
snapshots** exist for 5 journal entries, so `drizzle-kit generate` diffs
`schema.ts` against `0001` and re-emits everything from `0002` onward.

## Why migrations were applied by hand

Rebuilding the schema from scratch was impossible, for three independent reasons:

1. `location_position_gist_idx` was declared `.concurrently()`.
   `CREATE INDEX CONCURRENTLY` is illegal inside a transaction and `drizzle-kit`
   wraps every migration in one, so `db:migrate` could never apply it. The
   obsolete `0010` says as much in its own header.
2. `jsonPositionToGeography` emitted `(expr)::geography`. Postgres only lets an
   expression index omit surrounding parentheses when the expression is a plain
   function call, so the generated index failed with
   `syntax error at or near "::"`.
3. No migration ever created the **PostGIS** extension, which production has and
   a fresh database does not.

## Do not run `db:generate` and commit the result

It emits SQL that recreates objects which already exist in production
(`CREATE TABLE temp_worker`, the three-identity columns, the PostGIS index) and
would fail on its first statement. `.github/workflows/schema-drift.yml` is
warning-only for exactly this reason.

## The fix

A baseline squash — a single `0000_baseline` generated from `schema.ts` and
verified to reproduce production exactly, plus one bookkeeping row inserted into
`__drizzle_migrations` **without executing it**. Old migrations get archived under
`drizzle/_archive/` rather than deleted.

Tracked in PR #8, along with fixes for all three bugs above. Once it lands,
restore `exit 1` in `schema-drift.yml`.

## Commands

```bash
bun run --filter @repo/database db:generate   # generate a migration from schema.ts
bun run --filter @repo/database db:migrate    # apply pending migrations
bun run --filter @repo/database db:studio     # browse the database
```

Database-backed tests (`exploration-*`, `preservation-*`) need `DATABASE_URL` and
only run with `RUN_DB_TESTS=true`.
