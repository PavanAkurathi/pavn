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
