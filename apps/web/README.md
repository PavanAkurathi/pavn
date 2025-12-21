# Web App (Next.js)

The main web application for Workers Hive / Pavn. It is a **Next.js 15+** application using the **App Router**.

## Features

- **Authentication**: Powered by @repo/auth (Better Auth).
- **Database**: Connects via @repo/database (Drizzle).
- **UI**: Uses @repo/ui components.
- **Turbopack**: Fast local development.

## Directory Structure

- \`app/api/auth\`: API Route for Better Auth integration.
- \`app/(auth)\`: Public authentication pages (Login, Signup).
- \`app/(dashboard)\`: Protected application routes.
- \`middleware.ts\`: Route protection logic.

## Commands

- \`bun dev\`: Start the development server (localhost:3000).
- \`bun run build\`: Build the application for production.
- \`bun start\`: Start the production server.

## Environment Variables

Ensure your \`.env\` file in the root contains:

- \`DATABASE_URL\`: Connection string for Neon Postgres.
- \`BETTER_AUTH_SECRET\`: Secret for auth encryption.
- \`NEXT_PUBLIC_APP_URL\`: Base URL (http://localhost:3000).
