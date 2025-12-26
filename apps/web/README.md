# Web App

The main SaaS application for Antigravity, built with Next.js 16.

## Features

-   **Dashboard**: Shift management, user profiles, and organization settings.
-   **Authentication**: Secure login/signup via `@repo/auth`.
-   **Payments**: Stripe integration for subscriptions.
-   **Maps**: Google Maps integration for location services.

## Getting Started

Run the development server:

```bash
npm run dev
# or
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Configuration

Ensure all environment variables are set in `.env` (see `.env.example` if available). Key variables include database connection strings, Stripe keys, and auth secrets.
