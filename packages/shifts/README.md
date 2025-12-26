# @repo/shifts

Domain-specific package for Shift Management logic in the Antigravity SaaS platform.

## Features

-   **Service Layer**: `shiftService` for fetching and managing shifts/timesheets.
-   **Types**: Shared interface definitions for `Shift`, `TimesheetWorker`, etc.
-   **Mock Data**: Development data for testing UI scenarios.

## Usage

```ts
import { shiftService } from "@repo/shifts";

const shifts = await shiftService.getShifts({ view: 'upcoming' });
```
