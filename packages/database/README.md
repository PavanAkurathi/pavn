# Database

`@repo/database` owns the shared database layer for the monorepo.

## Responsibilities

- Drizzle connection setup
- schema definitions
- migrations
- audit writes
- spatial helpers
- worker-role normalization helpers

## Source Layout

- `src/db.ts`
  - database connection
- `src/schema.ts`
  - shared table schema
- `src/audit.ts`
  - audit-log helpers
- `src/spatial.ts`
  - PostGIS / coordinate helpers
- `src/worker-roles.ts`
  - worker role normalization and upsert helpers
- `drizzle/`
  - SQL migrations
- `scripts/`
  - operational scripts for local/dev maintenance

## Commands

Run from the repo root or inside `packages/database`:

```bash
bun run db:generate
bun run db:migrate
bun run db:migrate:manual
bun run db:push
bun run db:studio
```

## Boundary Rule

Keep domain decisions out of this package.

This package should provide:

- schema
- query primitives
- shared DB helpers

It should not own:

- shift publication rules
- auth decisions
- attendance policy logic
