# @repo/database

This package handles all database interactions for the monorepo, providing a type-safe ORM via Drizzle and a PostgreSQL connection via Neon (serverless).

## Tech Stack

- **Drizzle ORM**: TypeScript ORM.
- **Neon**: Serverless PostgreSQL.
- **PostgresJS**: Driver for connection.

## Key Files

- \`src/schema.ts\`: Defines the database schema (tables, relations).
  - **Identity**: \`user\`, \`session\`, \`verification\`.
  - **Tenancy**: \`organization\`, \`location\`.
  - **Access**: \`member\`, \`invitation\`.
- \`src/db.ts\`: Initializes the database connection export.
- \`drizzle.config.ts\`: Configuration for Drizzle Kit (migrations).

## Scripts

- \`bun run generate\`: Generate SQL migration files from schema changes.
- \`bun run migrate\`: Apply migrations to the production database.
- \`bun run push\`: Push schema changes directly (prototyping only).
- \`bun run studio\`: Open Drizzle Studio to view data.

## Usage

```typescript
import { db } from "@repo/database";
import { schema } from "@repo/database/schema";

// Example Query
const users = await db.query.user.findMany();
```
