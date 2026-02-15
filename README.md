# Pavn (WorkersHive)

Pavn is a comprehensive workforce management platform designed to streamline shift scheduling, geofencing, and worker management.

## Project Structure

This is a monorepo managed by [Turbo](https://turbo.build/).

### Apps
- **`apps/web`**: The main web application (Next.js) for business admins and managers.
- **`apps/workers`**: The mobile application (Expo/React Native) for gig workers.
- **`apps/api`**: The backend API server (Hono) handling authentication, shifts, and logic.
- **`apps/docs`**: Documentation site (Next.js).

### Packages (`@repo/*`)
- **`auth`**: Authentication logic using Better Auth.
- **`database`**: Database schema, Drizzle ORM setup, and migrations.
- **`ui`**: Shared UI component library.
- **`email`**: Transactional email templates and logic.
- **`notifications`**: Push notification services.
- **`geofence`**: Geofencing and location verification logic.
- **`shifts-service`**: Core shift management logic.
- **`config`**: Shared configuration files.
- **`utils`**: Common utility functions.

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (Runtime & Package Manager)
- [Docker](https://www.docker.com/) (For local database, optional if using Neon)
- [PostgreSQL](https://www.postgresql.org/) (Database)

### Installation

```bash
# Install dependencies
bun install
```

### Development

To start the development environment:

1.  **Backend & Web**:
    ```bash
    bun run dev
    ```
    This starts the API server (`localhost:4005`), Web App (`localhost:3000`), and other services.

2.  **Mobile App**:
    Open a *separate* terminal:
    ```bash
    cd apps/workers
    npx expo start
    ```
    Press `i` for iOS Simulator or `a` for Android Emulator.

### Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

**Critical Variables:**
- `DATABASE_URL`: Connection string for PostgreSQL (Neon).
- `BETTER_AUTH_SECRET`: Secret for authentication sessions.
- `TWILIO_*`: Credentials for SMS OTP.
- `NEXT_PUBLIC_APP_URL`: URL of the web application.
