# Pavn API Server (`apps/api`)

The central backend service for the Pavn platform, built with **[Hono](https://hono.dev/)** and running on **[Bun](https://bun.sh/)**.

## Features
- **Authentication**: Powered by **[Better-Auth](https://better-auth.com/)** (Email/Password, SMS OTP, Organization multi-tenancy).
- **Shifts**: CRUD operations for shifts, assignments, and rosters, including full support for **recurring shift patterns**.
- **Geofence**: Secure verification for job location clock-ins/outs.
- **Notifications**: Push notifications via Expo and intelligent Email services.

## Running Locally

The API is started as part of the root `bun run dev` command.
To run it in isolation:

```bash
cd apps/api
bun run dev
```

**Note:** You must have environment variables loaded. The `dev` script automatically attempts to load `.env` from the project root.

## Architecture

- **`src/index.ts`**: Entry point, middleware setup, and route mounting.
- **`src/routes/`**: Route definitions grouped by feature (e.g., `auth`, `shifts`, `webhook`).
- **Middleware**:
    - `auth`: Verifies Session Tokens / Bearer Tokens via Better-Auth.
    - `cors`: Handles Cross-Origin Resource Sharing.
    - `logger`: Request logging.
    - `timeout`: Global 30-second request timeout middleware for system reliability.

## API Documentation

Interactive API documentation (Swagger/OpenAPI) is available at:
`http://localhost:4005/docs` (when server is running).
