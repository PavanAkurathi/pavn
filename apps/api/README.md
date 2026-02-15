# Pavn API Server (`apps/api`)

The central backend service for the Pavn platform, built with **Hono**.

## Features
- **Authentication**: Powered by Better Auth (Email/Password, SMS OTP).
- **Shifts**: CRUD operations for shifts, assignments, and rosters.
- **Geofence**: Location verification for clock-ins/outs.
- **Notifications**: Push notifications via Expo and Email service.

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
    - `auth`: Verifies Session Tokens / Bearer Tokens.
    - `cors`: Handles Cross-Origin Resource Sharing.
    - `logger`: Request logging.

## API Documentation

Interactive API documentation (Swagger/OpenAPI) is available at:
`http://localhost:4005/docs` (when server is running).
