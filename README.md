# Antigravity SaaS (Pavn)

Monorepo for the Antigravity SaaS platform, built with [Turborepo](https://turbo.build/repo).

## Apps & Packages

### Applications

-   [`apps/web`](./apps/web): Main SaaS application (Next.js 16).
-   [`apps/docs`](./apps/docs): Documentation site (Next.js 16).

### Shared Packages

-   [`@repo/auth`](./packages/auth): Authentication logic (Better Auth + Drizzle).
-   [`@repo/database`](./packages/database): Database schema and connection (Neon Postgres + Drizzle).
-   [`@repo/email`](./packages/email): Transactional email service (Resend).
-   [`@repo/shifts`](./packages/shifts): Shift management domain logic.
-   [`@repo/ui`](./packages/ui): Shared UI component library (Shadcn UI).
-   [`@repo/eslint-config`](./packages/eslint-config): Shared ESLint configurations.
-   [`@repo/typescript-config`](./packages/typescript-config): Shared TSConfig bases.

## Getting Started

1.  **Install dependencies:**

    ```bash
    npm install
    # or
    bun install
    ```

2.  **Environment Setup:**

    Copy `.env.example` to `.env` in the root and relevant package directories (`apps/web`, `packages/database`, etc.) and populate the required keys.

3.  **Run Development Server:**

    ```bash
    npm run dev
    # or
    bun run dev
    ```

    -   Web App: [http://localhost:3000](http://localhost:3000)
    -   Docs App: [http://localhost:3001](http://localhost:3001)

## Development workflow

This repo uses [Turborepo](https://turbo.build/repo) for task orchestration.

-   **Build all**: `npm run build`
-   **Lint all**: `npm run lint`
-   **Type check all**: `npm run check-types`
