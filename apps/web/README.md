# Pavn Web Dashboard (`apps/web`)

The administrative dashboard for business owners and managers, built with **[Next.js](https://nextjs.org/)** and managed within a **[Turborepo](https://turbo.build/)** via **[Bun](https://bun.sh/)**.

## Features
- **Dashboard**: Overview of shifts, attendance, and costs.
- **Roster**: Manage worker profiles and assignments.
- **Schedule**: Drag-and-drop shift scheduling calendar, including full **recurring shift pattern** support.
- **Geofence Map**: Visual editor for job locations and geofences.
- **Notifications**: Real-time notification bell and center.

## Running Locally

1.  **Start Dev Server**:
    The web app runs as part of the root command:
    ```bash
    bun run dev
    ```
    Or individually:
    ```bash
    cd apps/web
    bun run dev
    ```

2.  **Access**:
    Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Technologies
- **Next.js 14+**: App Router for routing and layouts.
- **Authentication**: Powered by **[Better-Auth](https://better-auth.com/)**.
- **Tailwind CSS**: Styling framework.
- **Radix UI / Shadcn**: Component primitives.
- **React Query**: Data fetching and state management.
