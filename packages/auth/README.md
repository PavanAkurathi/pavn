# @repo/auth

Shared authentication package for the Antigravity SaaS monorepo. Built on top of [Better Auth](https://www.better-auth.com/) and integrated with [Drizzle ORM](https://orm.drizzle.team/).

## Features

-   **Better Auth**: Robust authentication logic.
-   **Drizzle Adapter**: Persists sessions and users to Neon Postgres via `@repo/database`.
-   **Email Integration**: Sends OTPs and magic links using `@repo/email`.
-   **Client & Server**: Exports utilities for both server-side (`.`) and client-side (`./client`) usage.

## Installation

```bash
npm install @repo/auth
# or
bun add @repo/auth
```

## Usage

### Server-Side

```ts
import { auth } from "@repo/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({
    headers: await headers()
});
```

### Client-Side

```ts
import { createAuthClient } from "@repo/auth/client";

const authClient = createAuthClient();

const { data, error } = await authClient.signIn.email({
    email,
    password
});
```
