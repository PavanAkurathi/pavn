# Pavn Geofence (`@repo/geofence`)

Shared internal package for handling secure, client-side geofence validation and distance calculations across the Pavn platform.

## Features
- **Geofence Validation**: Logic to verify if a worker is within the required distance from a job location during clock-in/out.
- **Distance Calculation**: Accurate geospatial math (Haversine formula) for coordinate distance checks.

## Usage

Import the utility functions directly into your application (e.g., `apps/workers` or `apps/api`):

```typescript
import { isWithinGeofence, calculateDistance } from "@repo/geofence";
```

## Security Note
This package explicitly handles client-side validation logic designed to provide clear error messages (`"You must be at the job location to clock in/out"`) without leaking exact distance variances, preventing users from attempting to "game" or spoof the geofence system.
