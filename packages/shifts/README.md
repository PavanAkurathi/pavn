# Pavn Shifts Service (`@repo/shifts`)

Core shared package within the Pavn monorepo focused on core shift management logic and complex scheduling operations.

## Features
- **Shift Scheduling**: Core data logic for creating, updating, and publishing shifts.
- **Recurring Shifts**: Robust utility (`recurrence.ts`) to expand recurring shift patterns (e.g., "Every Monday and Wednesday for 4 weeks") into specific, actionable shift dates.
- **Shift Operations**: Logic handlers for worker assignments and status updates.

## Usage

Import the required services or utilities into the `apps/api` controller:

```typescript
import { expandRecurrence, publishShiftPattern } from "@repo/shifts";
```
