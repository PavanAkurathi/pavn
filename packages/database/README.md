# Pavn Database (`@repo/database`)

Shared database package handling schema definitions, migrations, and connection management.

## Tech Stack
- **PostgreSQL**: Production database (Neon).
- **Drizzle ORM**: TypeScript ORM and Query Builder.

## Directory Structure
- **`src/schema.ts`**: All table definitions.
- **`src/index.ts`**: Exports for `db` instance and schema.
- **`drizzle/`**: Migration SQL files.

## Commands

Run these from the root directory or inside `packages/database`:

```bash
# Generate migration files after changing schema.ts
bun run db:generate

# Push changes directly to the database (Local Dev)
bun run db:push

# View database with Drizzle Studio
bun run db:studio
```

## Connection
The package exports a singleton `db` instance that automatically connects using the `DATABASE_URL` environment variable.
