# @repo/auth

This package provides the authentication infrastructure using **Better Auth**. It abstracts the auth logic from the application layer, ensuring a centralized and secure implementation.

## Features

- **Email & Password Authentication**.
- **Multi-Tenancy**: Built-in Organization and Member support.
- **Strict Isolation**: Custom hooks enforce "1 User = 1 Organization" creation flow.
- **Unified Client**: Exports a pre-configured \`authClient\` for React apps.

## Key Files

- \`src/auth.ts\`: Server-side Better Auth configuration.
  - Includes **Auto-Create Organization** hook on sign-up.
- \`src/client.ts\`: Client-side library export (React hooks).
  - Exports \`betterFetch\` for middleware.

## Usage

### Server-Side (API Routes)

```typescript
import { auth } from "@repo/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### Client-Side (React Components)

```typescript
"use client";
import { authClient } from "@repo/auth/client";

function Login() {
  const { data: session } = authClient.useSession();
  
  const signIn = async () => {
    await authClient.signIn.email({ 
      email: "...", 
      password: "..." 
    });
  };
}
```

## Security Architecture

### Data Collection & Privacy
- **Identity**: Stores Name, Email, Phone, and optional Profile Image.
- **Credentials**: Passwords are **hashed** and stored in the `account` table, never in the `user` table.
- **Audit**: Captures IP Address and User Agent for session security.

### The "Bouncer & Bridge" Model
- **The Bridge (`@repo/auth`)**: Handles identity verification, session creation, and organization management.
- **The Bouncer (`apps/web/proxy.ts`)**: Enforces access control at the edge.
  - **Dashboard**: Protected by strict session validation.
  - **Registration**: Geo-fenced to US/CA IP addresses.

