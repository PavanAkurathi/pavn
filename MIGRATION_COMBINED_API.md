# Combined API Gateway Migration

## Overview
This branch combines all three API services (Shifts, Geofence, and API) into a single unified Hono application running on port 4005.

## Changes Made

### 1. Updated `packages/shifts/src/server.ts`
**Before:** Only contained shifts service routes  
**After:** Now serves as a unified API gateway mounting all routes from:
- **Shifts Service** (original routes)
- **Geofence Service** (/clock-in, /clock-out, /location, /geocode, /corrections, /override, /flagged)
- **API Service** (/devices, /preferences, /manager-preferences)

### 2. Updated `apps/workers/lib/config.ts`
**Before:** 
- AUTH_API_URL → port 4005
- SHIFTS_API_URL → port 4005
- GEOFENCE_API_URL → port 4006 (WRONG)
- API_URL → port 4006

**After:** All services point to port 4005 (unified gateway)

## Deployment Impact

### Local Development
```bash
# All services now accessible at:
http://localhost:4005

# Example endpoints:
http://localhost:4005/api/auth/session
http://localhost:4005/clock-in
http://localhost:4005/shifts/upcoming
http://localhost:4005/devices/register
http://localhost:4005/preferences
```

### Production (Railway)
The existing `shift-serf.up.railway.app` service now serves ALL APIs.

**Before (Broken):**
- shift-serf.up.railway.app → Shifts only
- Missing geofence service (clock-in/clock-out broken)
- Missing API service (devices/preferences broken)

**After (Fixed):**
- shift-serf.up.railway.app → ALL services unified

### Mobile App Configuration

**Production Environment Variables:**
```bash
EXPO_PUBLIC_AUTH_API_URL=https://shift-serf.up.railway.app
EXPO_PUBLIC_SHIFTS_API_URL=https://shift-serf.up.railway.app
EXPO_PUBLIC_GEOFENCE_API_URL=https://shift-serf.up.railway.app
EXPO_PUBLIC_API_URL=https://shift-serf.up.railway.app
```

All four URLs now point to the same service.

## Testing Checklist

### Local Testing
- [ ] Start unified server: `cd packages/shifts && bun dev`
- [ ] Test auth: `curl http://localhost:4005/health`
- [ ] Test shifts: `curl http://localhost:4005/shifts/upcoming` (with auth headers)
- [ ] Test geofence: `curl http://localhost:4005/clock-in` (with auth + payload)
- [ ] Test API: `curl http://localhost:4005/devices/register` (with auth + payload)

### Mobile App Testing
- [ ] Test authentication flow
- [ ] Test fetching worker shifts
- [ ] Test clock-in/clock-out functionality
- [ ] Test device registration
- [ ] Test preferences loading

## Migration Notes

### No Breaking Changes for Web App
The Next.js web app (`apps/web`) already makes backend-to-backend calls to the shifts service via `SHIFT_SERVICE_URL` env var. No changes needed.

### Railway Deployment
1. The existing `shift-serf` (pavn) service will automatically deploy this combined gateway
2. No need to create separate geofence or API services
3. Set PORT=4005 (or let Railway auto-assign)

## Rollback Plan
If issues arise, revert to commit `7ef28c3c4d2b06c17e44d52b7334e1ae6bad631f` (before this branch).

## Related Tickets
- WH-MOB-001: AUTH_API_URL configuration
- WH-MOB-002: Hardcoded localhost URLs
- WH-MOB-003: Missing deviceTimestamp parameter
