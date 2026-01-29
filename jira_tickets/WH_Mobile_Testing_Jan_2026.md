# WorkersHive - Mobile Worker Testing Tickets

**Created:** January 28, 2026  
**Sprint:** Mobile Beta Readiness  
**Epic:** WH-MOBILE - Worker App Production Readiness

---

## 📋 TICKET OVERVIEW

| Ticket ID | Title | Priority | Points | Blocker? |
|-----------|-------|----------|--------|----------|
| WH-MOB-001 | Fix auth-client.ts localhost hardcoding | 🔴 P0 | 1 | **YES** |
| WH-MOB-002 | Add AUTH_API_URL to centralized config | 🔴 P0 | 1 | **YES** |
| WH-MOB-003 | Add deviceTimestamp to clock-in/out requests | 🔴 P0 | 1 | **YES** |
| WH-MOB-004 | Create .env.staging with Railway URLs | 🟡 P1 | 1 | No |
| WH-MOB-005 | Add clock-in/out request validation on mobile | 🟡 P1 | 2 | No |
| WH-MOB-006 | Implement geofence proximity feedback UI | 🟢 P2 | 3 | No |

**Total Points:** 9  
**Estimated Time:** 4-6 hours

---

## 🔴 CRITICAL BLOCKERS

### WH-MOB-001: Fix auth-client.ts localhost hardcoding

**Priority:** 🔴 CRITICAL (P0)  
**Story Points:** 1  
**Type:** Bug  
**Component:** Mobile / Auth  
**Blocked By:** None  
**Blocks:** All mobile testing on physical devices

#### Problem Statement

`auth-client.ts` bypasses the smart URL detection in `config.ts` and hardcodes `localhost:4005`:

```typescript
// Current (BROKEN)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4005";
```

When running on a physical device via Expo Go, `localhost` resolves to the phone itself (not the dev machine), causing auth to fail immediately. The worker cannot even reach the login screen.

Meanwhile, `config.ts` already has working LAN IP detection:

```typescript
const getLocalUrl = (port: number) => {
    if (Constants.expoConfig?.hostUri) {
        const ip = Constants.expoConfig.hostUri.split(':')[0];
        return `http://${ip}:${port}`;
    }
    return `http://localhost:${port}`;
};
```

#### Root Cause

`auth-client.ts` was written before `config.ts` was standardized. It doesn't import or use the centralized config.

#### Acceptance Criteria

- [ ] `auth-client.ts` imports `CONFIG` from `./config`
- [ ] `authClient.baseURL` uses `CONFIG.AUTH_API_URL`
- [ ] Physical device can reach auth endpoint (verify with console log)
- [ ] Simulator still works (regression test)

#### Implementation

**File:** `apps/workers/lib/auth-client.ts`

```typescript
// BEFORE
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { organizationClient, phoneNumberClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4005";

export const authClient = createAuthClient({
    baseURL: BASE_URL,
    // ...
});

// AFTER
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { organizationClient, phoneNumberClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import { CONFIG } from "./config";

export const authClient = createAuthClient({
    baseURL: CONFIG.AUTH_API_URL,
    plugins: [
        organizationClient(),
        phoneNumberClient(),
        expoClient({
            scheme: "workers",
            storage: SecureStore,
        })
    ]
});
```

#### Testing

1. Run `npx expo start` on dev machine
2. Open Expo Go on physical iPhone/Android
3. Scan QR code
4. Verify login screen loads without network error
5. Verify SMS OTP is sent successfully
6. Verify auth token is stored and persisted

#### Definition of Done

- [ ] Code change merged to main
- [ ] Physical device login works
- [ ] Simulator login still works
- [ ] No TypeScript errors

---

### WH-MOB-002: Add AUTH_API_URL to centralized config

**Priority:** 🔴 CRITICAL (P0)  
**Story Points:** 1  
**Type:** Enhancement  
**Component:** Mobile / Config  
**Blocked By:** None  
**Blocks:** WH-MOB-001

#### Problem Statement

`config.ts` defines `SHIFTS_API_URL` (port 4005), `GEOFENCE_API_URL` (port 4006), and `API_URL` (port 4006), but **auth runs on port 4005** and there's no dedicated `AUTH_API_URL`.

This forces `auth-client.ts` to either:
- Reuse `SHIFTS_API_URL` (confusing naming)
- Hardcode its own URL (current broken state)

#### Acceptance Criteria

- [ ] `CONFIG.AUTH_API_URL` exists and points to port 4005
- [ ] Uses same `getLocalUrl()` pattern for LAN IP detection
- [ ] Environment variable override available: `EXPO_PUBLIC_AUTH_API_URL`

#### Implementation

**File:** `apps/workers/lib/config.ts`

```typescript
// BEFORE
export const CONFIG = {
    SHIFTS_API_URL: process.env.EXPO_PUBLIC_SHIFTS_API_URL || getLocalUrl(4005),
    GEOFENCE_API_URL: process.env.EXPO_PUBLIC_GEOFENCE_API_URL || getLocalUrl(4006),
    API_URL: process.env.EXPO_PUBLIC_API_URL || getLocalUrl(4006),
};

// AFTER
export const CONFIG = {
    AUTH_API_URL: process.env.EXPO_PUBLIC_AUTH_API_URL || getLocalUrl(4005),
    SHIFTS_API_URL: process.env.EXPO_PUBLIC_SHIFTS_API_URL || getLocalUrl(4005),
    GEOFENCE_API_URL: process.env.EXPO_PUBLIC_GEOFENCE_API_URL || getLocalUrl(4006),
    API_URL: process.env.EXPO_PUBLIC_API_URL || getLocalUrl(4006),
};
```

#### Port Reference

| Service | Port | Config Key |
|---------|------|------------|
| Auth (Better Auth) | 4005 | `AUTH_API_URL` |
| Shifts API | 4005 | `SHIFTS_API_URL` |
| Geofence API | 4006 | `GEOFENCE_API_URL` |
| General API | 4006 | `API_URL` |

#### Definition of Done

- [ ] `AUTH_API_URL` added to CONFIG
- [ ] TypeScript compiles without errors
- [ ] Console.log in auth-client shows correct URL on physical device

---

### WH-MOB-003: Add deviceTimestamp to clock-in/out requests

**Priority:** 🔴 CRITICAL (P0)  
**Story Points:** 1  
**Type:** Bug  
**Component:** Mobile / Geofence  
**Blocked By:** None  
**Blocks:** Clock-in/out functionality

#### Problem Statement

The backend `clock-in.ts` controller requires `deviceTimestamp` for replay attack prevention:

```typescript
// Backend expects this (clock-in.ts line 15)
const ClockInSchema = z.object({
    shiftId: z.string(),
    latitude: z.string(),
    longitude: z.string(),
    accuracyMeters: z.number().optional(),
    deviceTimestamp: z.string().datetime(), // REQUIRED
});
```

But `useGeofence.ts` hook doesn't send it:

```typescript
// Current mobile code (BROKEN)
const data = await api.geofence.clockIn({
    shiftId,
    latitude: String(location.coords.latitude),
    longitude: String(location.coords.longitude),
    accuracyMeters: location.coords.accuracy || undefined
    // ❌ Missing deviceTimestamp
});
```

**Result:** Every clock-in/out attempt returns 400 Bad Request with validation error.

#### Acceptance Criteria

- [ ] `useGeofence.ts` sends `deviceTimestamp` in ISO format
- [ ] Both `clockIn()` and `clockOut()` functions include it
- [ ] Backend accepts the request (no validation errors)

#### Implementation

**File:** `apps/workers/hooks/useGeofence.ts`

```typescript
// BEFORE
async function clockIn(shiftId: string) {
    setLoading(true);
    setError(null);
    try {
        const location = await LocationService.getCurrentLocation();
        if (!location) {
            throw new Error("Location permission denied or unavailable");
        }

        const data = await api.geofence.clockIn({
            shiftId,
            latitude: String(location.coords.latitude),
            longitude: String(location.coords.longitude),
            accuracyMeters: location.coords.accuracy || undefined
        });

        return data;
    } catch (err: any) {
        setError(err.message);
        throw err;
    } finally {
        setLoading(false);
    }
}

// AFTER
async function clockIn(shiftId: string) {
    setLoading(true);
    setError(null);
    try {
        const location = await LocationService.getCurrentLocation();
        if (!location) {
            throw new Error("Location permission denied or unavailable");
        }

        const data = await api.geofence.clockIn({
            shiftId,
            latitude: String(location.coords.latitude),
            longitude: String(location.coords.longitude),
            accuracyMeters: location.coords.accuracy || undefined,
            deviceTimestamp: new Date().toISOString()  // ADD THIS
        });

        return data;
    } catch (err: any) {
        setError(err.message);
        throw err;
    } finally {
        setLoading(false);
    }
}

// SAME FIX FOR clockOut()
async function clockOut(shiftId: string) {
    // ... same pattern ...
    const data = await api.geofence.clockOut({
        shiftId,
        latitude: String(location.coords.latitude),
        longitude: String(location.coords.longitude),
        accuracyMeters: location.coords.accuracy || undefined,
        deviceTimestamp: new Date().toISOString()  // ADD THIS
    });
    // ...
}
```

#### Also Update Type Definition

**File:** `apps/workers/lib/api.ts`

```typescript
// Update ClockInRequest interface
export interface ClockInRequest {
    shiftId: string;
    latitude: string;
    longitude: string;
    accuracyMeters?: number;
    deviceTimestamp: string;  // ADD THIS (required)
}
```

#### Testing

1. Create a test shift assigned to yourself
2. Stand within geofence radius
3. Attempt clock-in
4. Verify response is 200 OK (not 400 Bad Request)
5. Verify `clockInTime` in response matches device time (within 5 min)

#### Definition of Done

- [ ] `deviceTimestamp` added to both clock-in and clock-out
- [ ] TypeScript interface updated
- [ ] Backend returns success response
- [ ] No "REPLAY_DETECTED" errors in normal use

---

## 🟡 HIGH PRIORITY

### WH-MOB-004: Create .env.staging with Railway URLs

**Priority:** 🟡 HIGH (P1)  
**Story Points:** 1  
**Type:** Task  
**Component:** Mobile / DevOps  
**Blocked By:** WH-MOB-001, WH-MOB-002  
**Blocks:** None

#### Description

For beta testing, pointing the mobile app at Railway staging eliminates localhost complexity entirely. Create a `.env.staging` file with production-ready URLs.

#### Acceptance Criteria

- [ ] `.env.staging` file created in `apps/workers/`
- [ ] All API URLs point to Railway
- [ ] `.env.staging` added to `.gitignore` (contains no secrets but good practice)
- [ ] README updated with instructions for switching environments

#### Implementation

**File:** `apps/workers/.env.staging`

```bash
# WorkersHive Mobile - Staging Environment
# Use: cp .env.staging .env && npx expo start --clear

EXPO_PUBLIC_AUTH_API_URL=https://muttonbiryani.up.railway.app
EXPO_PUBLIC_SHIFTS_API_URL=https://muttonbiryani.up.railway.app
EXPO_PUBLIC_GEOFENCE_API_URL=https://muttonbiryani.up.railway.app
EXPO_PUBLIC_API_URL=https://muttonbiryani.up.railway.app
```

**File:** `apps/workers/.env.example`

```bash
# WorkersHive Mobile - Environment Configuration
# Copy to .env and customize

# Local Development (default if not set)
# EXPO_PUBLIC_AUTH_API_URL=http://localhost:4005
# EXPO_PUBLIC_SHIFTS_API_URL=http://localhost:4005
# EXPO_PUBLIC_GEOFENCE_API_URL=http://localhost:4006
# EXPO_PUBLIC_API_URL=http://localhost:4006

# Staging (Railway)
EXPO_PUBLIC_AUTH_API_URL=https://muttonbiryani.up.railway.app
EXPO_PUBLIC_SHIFTS_API_URL=https://muttonbiryani.up.railway.app
EXPO_PUBLIC_GEOFENCE_API_URL=https://muttonbiryani.up.railway.app
EXPO_PUBLIC_API_URL=https://muttonbiryani.up.railway.app
```

#### Usage Instructions

```bash
# For local development (uses LAN IP auto-detection)
rm .env  # or don't create one

# For staging/beta testing
cp .env.staging .env
npx expo start --clear  # --clear is important to pick up env changes
```

#### Definition of Done

- [ ] `.env.staging` created
- [ ] `.env.example` updated with documentation
- [ ] App successfully connects to Railway when using staging env
- [ ] README.md updated with environment switching instructions

---

### WH-MOB-005: Add clock-in/out request validation on mobile

**Priority:** 🟡 HIGH (P1)  
**Story Points:** 2  
**Type:** Enhancement  
**Component:** Mobile / Validation  
**Blocked By:** WH-MOB-003  
**Blocks:** None

#### Description

Currently, validation only happens on the backend. If there's a validation error, the user sees a generic "Clock-in failed" message. Add client-side validation to:

1. Provide immediate feedback
2. Reduce unnecessary API calls
3. Give specific error messages

#### Acceptance Criteria

- [ ] Validate GPS accuracy before sending request (reject if > 200m)
- [ ] Validate location permissions are granted
- [ ] Show specific error messages for each failure mode
- [ ] Log validation failures for debugging

#### Implementation

**File:** `apps/workers/hooks/useGeofence.ts`

```typescript
import { z } from 'zod';

const ClockRequestSchema = z.object({
    shiftId: z.string().min(1, "Shift ID required"),
    latitude: z.string().regex(/^-?\d+\.?\d*$/, "Invalid latitude"),
    longitude: z.string().regex(/^-?\d+\.?\d*$/, "Invalid longitude"),
    accuracyMeters: z.number().max(200, "GPS signal too weak. Move to an open area.").optional(),
    deviceTimestamp: z.string().datetime("Invalid timestamp"),
});

async function clockIn(shiftId: string) {
    setLoading(true);
    setError(null);
    
    try {
        // 1. Get location
        const location = await LocationService.getCurrentLocation();
        if (!location) {
            throw new Error("Location permission denied. Please enable in Settings.");
        }

        // 2. Check accuracy BEFORE sending
        const accuracy = location.coords.accuracy || 0;
        if (accuracy > 200) {
            throw new Error(`GPS signal too weak (${Math.round(accuracy)}m accuracy). Move to an open area and try again.`);
        }

        // 3. Build request
        const request = {
            shiftId,
            latitude: String(location.coords.latitude),
            longitude: String(location.coords.longitude),
            accuracyMeters: accuracy,
            deviceTimestamp: new Date().toISOString()
        };

        // 4. Validate locally
        const validation = ClockRequestSchema.safeParse(request);
        if (!validation.success) {
            const msg = validation.error.errors[0]?.message || "Invalid request";
            throw new Error(msg);
        }

        // 5. Send to backend
        const data = await api.geofence.clockIn(request);
        return data;

    } catch (err: any) {
        console.error('[CLOCK_IN] Error:', err);
        setError(err.message);
        throw err;
    } finally {
        setLoading(false);
    }
}
```

#### Error Messages Reference

| Condition | Message |
|-----------|---------|
| No location permission | "Location permission denied. Please enable in Settings." |
| GPS accuracy > 200m | "GPS signal too weak (Xm accuracy). Move to an open area and try again." |
| Outside geofence | "You must be at the venue to clock in. You are Xm away." |
| Too early | "Cannot clock in more than X minutes before shift." |
| Already clocked in | "You have already clocked in at HH:MM." |
| Network error | "Unable to reach server. Check your connection." |

#### Definition of Done

- [ ] Client-side validation implemented
- [ ] Specific error messages shown to user
- [ ] Console logs for debugging
- [ ] Works offline (shows appropriate error)

---

## 🟢 NICE TO HAVE

### WH-MOB-006: Implement geofence proximity feedback UI

**Priority:** 🟢 MEDIUM (P2)  
**Story Points:** 3  
**Type:** Feature  
**Component:** Mobile / UI  
**Blocked By:** WH-MOB-001, WH-MOB-002, WH-MOB-003  
**Blocks:** None

#### Description

Currently, if a worker is outside the geofence, the clock-in button is either disabled with no explanation, or they get an error after tapping. Implement real-time proximity feedback so workers know:

1. How far they are from the venue
2. Whether they're inside the geofence radius
3. Visual indication of "getting closer"

#### Acceptance Criteria

- [ ] Show distance to venue in meters/feet
- [ ] Show geofence radius
- [ ] Color-coded indicator (red = outside, yellow = close, green = inside)
- [ ] Update in real-time as worker moves
- [ ] Works without draining battery excessively

#### UI Mockup

```
┌─────────────────────────────────────┐
│                                     │
│   📍 Boston Convention Center       │
│   123 Main St, Boston MA            │
│                                     │
│   ┌─────────────────────────────┐   │
│   │  🟢 You are at the venue    │   │
│   │     Distance: 45m           │   │
│   │     Required: within 100m   │   │
│   └─────────────────────────────┘   │
│                                     │
│   ┌─────────────────────────────┐   │
│   │       ⏰ CLOCK IN           │   │
│   └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

// When outside geofence:
┌─────────────────────────────────────┐
│   ┌─────────────────────────────┐   │
│   │  🔴 Too far from venue      │   │
│   │     Distance: 350m          │   │
│   │     Required: within 100m   │   │
│   │     Move 250m closer        │   │
│   └─────────────────────────────┘   │
│                                     │
│   ┌─────────────────────────────┐   │
│   │       ⏰ CLOCK IN           │   │  <- Disabled
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### Implementation Notes

- Use `expo-location` watchPositionAsync for real-time updates
- Calculate distance client-side using Haversine formula
- Throttle UI updates to every 3-5 seconds to save battery
- Stop watching when screen is not focused

#### Definition of Done

- [ ] Proximity indicator component created
- [ ] Real-time distance updates
- [ ] Color-coded status
- [ ] Battery-efficient implementation
- [ ] Works on iOS and Android
