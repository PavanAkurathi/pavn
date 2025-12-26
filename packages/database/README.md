# @repo/database

Shared database package providing the ORM client and schema definitions for the Antigravity SaaS platform. Connects to [Neon Postgres](https://neon.tech) using [Drizzle ORM](https://orm.drizzle.team/).

## Features

-   **Type-Safe Schema**: All database tables defined in TypeScript.
-   **Serverless Driver**: Uses `@neondatabase/serverless` for efficient connection pooling.
-   **Migration Tools**: Includes Drizzle Kit configuration for schema updates.

## Exports

-   `@repo/database`: Main entry point exporting the `db` instance.
-   `@repo/database/schema`: Exports all table definitions (`user`, `session`, `organization`, etc.).

## Scripts

Run these from the root using `turbo` or inside the package directory:

-   `npm run generate`: Generate SQL migration files.
-   `npm run push`: Push schema changes directly to the database (prototyping).
-   `npm run studio`: Open Drizzle Studio to browse data.

## Usage

```ts
import { db } from "@repo/database";
import { user } from "@repo/database/schema";
import { eq } from "drizzle-orm";

const users = await db.select().from(user).where(eq(user.email, "alice@example.com"));
```
