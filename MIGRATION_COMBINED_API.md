# Combined API Gateway Status

## Current State (After Hotfix)

The attempt to combine all services into a single gateway was **reverted** due to import errors.

### What's Working Now
- ✅ `packages/shifts/src/server.ts` - Back to original working state
- ✅ Shifts service routes functional
- ✅ Auth routes functional
- ✅ Server starts successfully on Railway

### What's Still Broken
- ❌ Geofence routes (`/clock-in`, `/clock-out`) - NOT available
- ❌ API routes (`/devices`, `/preferences`) - NOT available
- ❌ Mobile app will fail on clock-in/clock-out and device registration

### Why the Merge Failed
The combined gateway tried to import controllers directly:
```typescript
import { clockInController } from "@repo/geofence/src/controllers/clock-in";
```

But these paths don't exist as exports in the monorepo packages.

## Solutions Going Forward

### Option 1: Deploy Separate Services (Recommended)
Deploy geofence and API as separate Railway services:
1. Create `geofence` Railway service → Deploy `packages/geofence`
2. Create `api` Railway service → Deploy `packages/api`
3. Update mobile app config:
   ```bash
   EXPO_PUBLIC_AUTH_API_URL=https://shift-serf.up.railway.app
   EXPO_PUBLIC_SHIFTS_API_URL=https://shift-serf.up.railway.app  
   EXPO_PUBLIC_GEOFENCE_API_URL=https://geofence-xxx.up.railway.app
   EXPO_PUBLIC_API_URL=https://api-xxx.up.railway.app
   ```

### Option 2: Create Proper Exports
Fix the package exports and retry the combined gateway:
1. Update `packages/geofence/src/index.ts` to export all controllers
2. Update `packages/api/src/index.ts` to export all routes
3. Re-attempt the merge

### Option 3: Inline the Controllers
Copy controller code directly into `packages/shifts/src/server.ts` (not recommended - code duplication)

## Mobile App Status

### What Works
- ✅ Authentication (`/api/auth/*`)
- ✅ Fetching worker shifts (`/worker/shifts`)
- ✅ Shift management routes

### What's Broken
- ❌ Clock-in/clock-out (endpoints don't exist)
- ❌ Device registration (endpoint doesn't exist)  
- ❌ Preferences (endpoint doesn't exist)

## Deployment Timeline

1. **Current**: Server is running but missing geofence/API routes
2. **Next**: Choose Option 1 or Option 2 above
3. **Then**: Test mobile app end-to-end

---

**Bottom Line**: The mobile app config change to port 4005 is still valid, but you need to deploy the missing geofence and API services separately until we can properly combine them.
