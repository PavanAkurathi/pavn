# WorkersHive - Production-Ready Jira Tickets

**Generated:** January 16, 2026
**Based on:** Complete codebase analysis (4 batches)

---

## 🔴 CRITICAL - BLOCKING PRODUCTION

### TICKET WH-001: Fix Database Schema Drift - Missing Migrations

**Priority:** 🔴 CRITICAL (P0)
**Story Points:** 5
**Epic:** Database & Infrastructure
**Assignee:** Senior Backend Engineer

**Description:**

The database migrations are severely out of sync with `schema.ts`. Critical tables and fields are missing from production, which will cause the application to crash when geofencing or time-correction features are used.

**Acceptance Criteria:**

- [ ] All tables in `schema.ts` have corresponding migrations
- [ ] Run `drizzle-kit generate:pg` and review generated migrations
- [ ] Verify migrations create:
  - `workerLocation` table (GPS tracking)
  - `timeCorrectionRequest` table (dispute workflow)
  - 30+ missing fields in `shiftAssignment` (see technical details)
- [ ] Test migrations on staging database
- [ ] Apply migrations to production
- [ ] Verify production schema matches `schema.ts` exactly

**Technical Details:**

```bash
# Steps to execute:
cd packages/database

# 1. Generate missing migrations
drizzle-kit generate:pg

# 2. Review generated SQL files in drizzle/ folder

# 3. Test on staging
export DATABASE_URL="postgres://staging..."
drizzle-kit push:pg

# 4. Verify tables exist
psql $DATABASE_URL -c "\d worker_location"
psql $DATABASE_URL -c "\d time_correction_request"

# 5. Check shiftAssignment has all fields
psql $DATABASE_URL -c "\d+ shift_assignment" | grep clock_in_latitude
```

**Missing Fields in `shiftAssignment`:**
- `clock_in_latitude`, `clock_in_longitude`
- `clock_in_verified`, `clock_in_method`
- `clock_out_latitude`, `clock_out_longitude`
- `clock_out_verified`, `clock_out_method`
- `needs_review`, `review_reason`
- `last_known_latitude`, `last_known_longitude`, `last_known_at`
- `adjusted_by`, `adjusted_at`, `adjustment_notes`
- `hourly_rate_snapshot`, `gross_pay_cents`

**Missing Fields in Other Tables:**
- `shift.schedule_group_id`, `shift.contact_id`
- `location.geocoded_at`, `location.geocode_source`
- `user.emergency_contact`, `user.address`

**Verification Query:**
```sql
-- Run this after migration to verify all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should return 13 tables including worker_location and time_correction_request
```

**Dependencies:**
- None

**Risk:**
- HIGH - Without this, geofencing and time-correction features will crash in production

**Documentation:**
- Create `MIGRATIONS.md` documenting the process
- Add migration workflow to team wiki

---

### TICKET WH-002: Remove Orphaned `currency` Field from Shift Table

**Priority:** 🔴 CRITICAL (P0)
**Story Points:** 1
**Epic:** Database & Infrastructure
**Assignee:** Junior Backend Engineer

**Description:**

Migration 0003 created a `currency` field in the `shift` table with default value 'USD', but this field is not in the current `schema.ts`. This creates schema drift and may cause issues with Drizzle ORM.

**Acceptance Criteria:**

- [ ] Verify `currency` column exists in production
- [ ] Create migration to drop `currency` column
- [ ] Test migration on staging
- [ ] Apply to production
- [ ] Verify Drizzle queries work correctly after removal

**Technical Details:**

```sql
-- Check if column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'shift' AND column_name = 'currency';

-- Create new migration file manually or via Drizzle
-- File: packages/database/drizzle/0006_remove_currency.sql

ALTER TABLE shift DROP COLUMN IF EXISTS currency;
```

**Verification:**
```bash
# After migration
psql $DATABASE_URL -c "\d shift" | grep currency
# Should return nothing
```

**Dependencies:**
- Must be done AFTER WH-001 to avoid conflicts

**Risk:**
- MEDIUM - May break if any code still references this field

---

### TICKET WH-003: Fix Coordinate Type Mismatch - Migrate to DECIMAL

**Priority:** 🔴 CRITICAL (P0)
**Story Points:** 8
**Epic:** Geofencing & Location
**Assignee:** Senior Backend Engineer

**Description:**

GPS coordinates are stored inconsistently across tables:
- `location` table uses `DECIMAL(10,8)` ✅ CORRECT
- `shift_assignment` geofence fields use `TEXT` ❌ WRONG
- `worker_location` table uses `TEXT` ❌ WRONG

This forces string parsing everywhere and prevents using PostGIS spatial queries.

**Acceptance Criteria:**

- [ ] Create migration to convert all coordinate fields from TEXT to DECIMAL
- [ ] Update all coordinate fields to use `DECIMAL(10,8)` for latitude, `DECIMAL(11,8)` for longitude
- [ ] Update code to handle DECIMAL types instead of strings
- [ ] Remove `parseCoordinate()` utility function (no longer needed)
- [ ] Test geofence calculations with new types
- [ ] All tests pass

**Technical Details:**

```sql
-- Migration: 0007_fix_coordinate_types.sql

-- Fix shift_assignment
ALTER TABLE shift_assignment 
  ALTER COLUMN clock_in_latitude TYPE decimal(10,8) 
    USING NULLIF(clock_in_latitude, '')::decimal(10,8),
  ALTER COLUMN clock_in_longitude TYPE decimal(11,8) 
    USING NULLIF(clock_in_longitude, '')::decimal(11,8),
  ALTER COLUMN clock_out_latitude TYPE decimal(10,8) 
    USING NULLIF(clock_out_latitude, '')::decimal(10,8),
  ALTER COLUMN clock_out_longitude TYPE decimal(11,8) 
    USING NULLIF(clock_out_longitude, '')::decimal(11,8),
  ALTER COLUMN last_known_latitude TYPE decimal(10,8) 
    USING NULLIF(last_known_latitude, '')::decimal(10,8),
  ALTER COLUMN last_known_longitude TYPE decimal(11,8) 
    USING NULLIF(last_known_longitude, '')::decimal(11,8);

-- Fix worker_location
ALTER TABLE worker_location
  ALTER COLUMN latitude TYPE decimal(10,8) 
    USING latitude::decimal(10,8),
  ALTER COLUMN longitude TYPE decimal(11,8) 
    USING longitude::decimal(11,8),
  ALTER COLUMN venue_latitude TYPE decimal(10,8) 
    USING NULLIF(venue_latitude, '')::decimal(10,8),
  ALTER COLUMN venue_longitude TYPE decimal(11,8) 
    USING NULLIF(venue_longitude, '')::decimal(11,8);
```

**Code Changes Required:**

File: `packages/geofence/src/utils/distance.ts`
```typescript
// BEFORE
export function parseCoordinate(coord: string | number | undefined | null): number | null {
    if (coord === undefined || coord === null) return null;
    const num = Number(coord);
    return isNaN(num) ? null : num;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // ... implementation
}

// AFTER - Remove parseCoordinate entirely
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // ... implementation (no changes needed)
}
```

File: `packages/geofence/src/controllers/clock-in.ts`
```typescript
// BEFORE
const workerLat = parseCoordinate(latitude);
const workerLng = parseCoordinate(longitude);
const venueLat = parseCoordinate(venueLocation.latitude);
const venueLng = parseCoordinate(venueLocation.longitude);

// AFTER
const workerLat = Number(latitude);
const workerLng = Number(longitude);
const venueLat = Number(venueLocation.latitude);
const venueLng = Number(venueLocation.longitude);
```

**Files to Update:**
- `packages/geofence/src/controllers/clock-in.ts`
- `packages/geofence/src/controllers/clock-out.ts`
- `packages/geofence/src/controllers/ingest-location.ts`
- `packages/database/src/schema.ts` (update type hints)

**Testing:**
```typescript
// Test with real coordinates
const boston = { lat: 42.3601, lng: -71.0589 };
const malden = { lat: 42.4251, lng: -71.0662 };

const distance = calculateDistance(
  boston.lat, 
  boston.lng, 
  malden.lat, 
  malden.lng
);

// Should return ~7200 meters (7.2km)
expect(distance).toBeGreaterThan(7000);
expect(distance).toBeLessThan(7500);
```

**Dependencies:**
- Must be done AFTER WH-001 (schema migration)

**Risk:**
- HIGH - If migration fails, GPS tracking will be completely broken
- Test thoroughly on staging with real data

---

### TICKET WH-004: Implement Missing Break Enforcement in Approval Workflow

**Priority:** 🔴 CRITICAL (P0)
**Story Points:** 5
**Epic:** Compliance & Payroll
**Assignee:** Mid-Level Backend Engineer

**Description:**

The shift approval controller calculates worker pay but does NOT enforce mandatory break rules. Workers can work 8+ hours without any break deduction, which violates labor laws in most states.

**Acceptance Criteria:**

- [ ] Implement automatic break enforcement in `approve.ts`
- [ ] Add break rules to `time-rules.ts`
- [ ] Deduct 30 minutes unpaid break for shifts 6+ hours
- [ ] Add break enforcement configuration per organization
- [ ] Add audit trail when breaks are auto-added
- [ ] All existing approval tests pass
- [ ] New tests for break enforcement

**Technical Details:**

File: `packages/geofence/src/utils/time-rules.ts`
```typescript
// ADD THIS FUNCTION

interface BreakEnforcementResult {
  breakMinutes: number;
  wasEnforced: boolean;
  reason?: string;
}

/**
 * Enforces mandatory break rules based on shift duration
 * 
 * US Labor Standards:
 * - 6-8 hours: 30 min unpaid break (mandatory)
 * - 8+ hours: 30 min unpaid + 15 min paid breaks (varies by state)
 */
export function enforceBreakRules(
  clockIn: Date,
  clockOut: Date,
  recordedBreaks: number,
  state: 'MA' | 'CA' | 'NY' | 'default' = 'default'
): BreakEnforcementResult {
  const totalMinutes = differenceInMinutes(clockOut, clockIn);
  const totalHours = totalMinutes / 60;

  // If worker already took breaks, don't override
  if (recordedBreaks > 0) {
    return {
      breakMinutes: recordedBreaks,
      wasEnforced: false
    };
  }

  // Shift under 6 hours - no break required
  if (totalHours < 6) {
    return {
      breakMinutes: 0,
      wasEnforced: false
    };
  }

  // 6-8 hours: Mandatory 30 min unpaid break
  if (totalHours >= 6 && totalHours < 8) {
    return {
      breakMinutes: 30,
      wasEnforced: true,
      reason: 'Mandatory 30min break for 6+ hour shift'
    };
  }

  // 8+ hours: State-specific rules
  // Massachusetts: 30 min unpaid break
  // California: 30 min unpaid + 10 min paid every 4 hours
  // For MVP: Apply 30 min unpaid universally
  return {
    breakMinutes: 30,
    wasEnforced: true,
    reason: `Mandatory 30min break for ${totalHours.toFixed(1)}hr shift`
  };
}
```

File: `packages/shifts/src/controllers/approve.ts`
```typescript
// FIND THIS SECTION (around line 50)
if (assign.clockIn && assign.clockOut) {
  const totalMinutes = differenceInMinutes(assign.clockOut, assign.clockIn);
  const billableMinutes = Math.max(0, totalMinutes - (assign.breakMinutes || 0));
  
  // ADD THIS IMPORT AT TOP
  import { enforceBreakRules } from "@repo/geofence/utils/time-rules";
  
  // REPLACE ABOVE WITH:
  // Apply break enforcement
  const breakEnforcement = enforceBreakRules(
    assign.clockIn,
    assign.clockOut,
    assign.breakMinutes || 0
  );
  
  const billableMinutes = Math.max(0, totalMinutes - breakEnforcement.breakMinutes);
  const hours = billableMinutes / 60;
  const rate = shiftRecord.price || 0;
  const pay = Math.round(hours * rate);

  updates.push({
    id: assign.id,
    status: 'completed',
    grossPayCents: pay,
    hourlyRateSnapshot: rate,
    // ADD: Store break enforcement info
    breakMinutes: breakEnforcement.breakMinutes,
    adjustmentNotes: breakEnforcement.wasEnforced 
      ? breakEnforcement.reason 
      : null
  });
}
```

**Testing:**

```typescript
describe('Break Enforcement', () => {
  it('should enforce 30min break for 7hr shift with no recorded breaks', () => {
    const clockIn = new Date('2025-01-15T09:00:00Z');
    const clockOut = new Date('2025-01-15T16:00:00Z'); // 7 hours
    
    const result = enforceBreakRules(clockIn, clockOut, 0);
    
    expect(result.breakMinutes).toBe(30);
    expect(result.wasEnforced).toBe(true);
    expect(result.reason).toContain('Mandatory');
  });

  it('should not override worker-recorded breaks', () => {
    const clockIn = new Date('2025-01-15T09:00:00Z');
    const clockOut = new Date('2025-01-15T16:00:00Z');
    
    const result = enforceBreakRules(clockIn, clockOut, 45); // Worker took 45min
    
    expect(result.breakMinutes).toBe(45);
    expect(result.wasEnforced).toBe(false);
  });

  it('should not enforce breaks for short shifts', () => {
    const clockIn = new Date('2025-01-15T09:00:00Z');
    const clockOut = new Date('2025-01-15T13:00:00Z'); // 4 hours
    
    const result = enforceBreakRules(clockIn, clockOut, 0);
    
    expect(result.breakMinutes).toBe(0);
    expect(result.wasEnforced).toBe(false);
  });
});
```

**Dependencies:**
- None

**Risk:**
- MEDIUM - May reduce worker pay if they weren't taking breaks
- Communicate change to clients before deploying

**Documentation:**
- Add to compliance documentation
- Update approval workflow diagram

---

### TICKET WH-005: Fix Clock-Out Race Condition

**Priority:** 🔴 CRITICAL (P0)
**Story Points:** 3
**Epic:** Geofencing & Location
**Assignee:** Mid-Level Backend Engineer

**Description:**

When two workers clock out from the same shift simultaneously, both may see incomplete state and neither updates the shift status to 'completed'. This is a race condition that can leave shifts stuck in 'in-progress' status.

**Acceptance Criteria:**

- [ ] Add row-level locking to clock-out transaction
- [ ] Ensure shift status updates correctly even with concurrent clock-outs
- [ ] Add integration test for concurrent clock-outs
- [ ] Verify fix with load testing (10 concurrent clock-outs)

**Technical Details:**

File: `packages/geofence/src/controllers/clock-out.ts`

```typescript
// FIND THIS SECTION (around line 95)
await db.transaction(async (tx) => {
  // A. Update Assignment
  await tx.update(shiftAssignment)
    .set({
      clockOut: clockOutResult.recordedTime,
      // ... other fields
    })
    .where(eq(shiftAssignment.id, assignment.id));

  // B. Check if all assignments complete
  const allAssignments = await tx.query.shiftAssignment.findMany({
    where: eq(shiftAssignment.shiftId, shiftId)
  });

  // REPLACE WITH:
  
  // B. Check if all assignments complete (WITH ROW LOCK)
  const allAssignments = await tx.execute(sql`
    SELECT * FROM shift_assignment 
    WHERE shift_id = ${shiftId} 
    FOR UPDATE
  `);

  const allComplete = allAssignments.rows.every((a: any) =>
    a.clock_out !== null
  );

  if (allComplete) {
    await tx.update(shift)
      .set({ status: 'completed', updatedAt: now })
      .where(eq(shift.id, shiftId));
  }
  
  // ... rest of transaction
});
```

**Alternative Solution (Optimistic Locking):**

```typescript
// Add version field to shift table first
// Then use optimistic locking:

const result = await tx.update(shift)
  .set({ 
    status: 'completed', 
    updatedAt: now,
    version: sql`${shift.version} + 1`
  })
  .where(and(
    eq(shift.id, shiftId),
    eq(shift.version, currentVersion) // Only update if version matches
  ));

if (result.rowCount === 0) {
  // Another transaction beat us to it, that's OK
  console.log('Shift already marked completed by another worker');
}
```

**Testing:**

```typescript
// Integration test
describe('Concurrent Clock-Outs', () => {
  it('should handle 2 workers clocking out simultaneously', async () => {
    // Setup shift with 2 workers both clocked in
    const shift = await createTestShift({ workers: 2 });
    
    // Both workers clock out at same time
    const [result1, result2] = await Promise.all([
      clockOut(worker1.id, shift.id),
      clockOut(worker2.id, shift.id)
    ]);
    
    // Both should succeed
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    
    // Shift should be marked completed exactly once
    const finalShift = await db.query.shift.findFirst({
      where: eq(shift.id, shift.id)
    });
    
    expect(finalShift.status).toBe('completed');
  });
});
```

**Dependencies:**
- None

**Risk:**
- LOW - Fix is isolated to clock-out logic
- Existing behavior preserved, just more reliable

---

## 🟠 HIGH PRIORITY

### TICKET WH-006: Add Missing Database Indexes

**Priority:** 🟠 HIGH (P1)
**Story Points:** 2
**Epic:** Performance & Optimization
**Assignee:** Junior Backend Engineer

**Description:**

Several critical queries are missing indexes, causing table scans on large datasets. This will cause performance issues as data grows.

**Acceptance Criteria:**

- [ ] Add composite index on `shift(organization_id, status)`
- [ ] Add index on `shift_assignment.status`
- [ ] Add index on `shift.start_time, organization_id` (composite)
- [ ] Verify query performance improves
- [ ] Run `EXPLAIN ANALYZE` on key queries before/after

**Technical Details:**

```sql
-- Migration: 0008_add_missing_indexes.sql

-- Composite index for common shift queries (filter by org + status)
CREATE INDEX IF NOT EXISTS shift_org_status_idx 
ON shift(organization_id, status);

-- Index for assignment status filtering
CREATE INDEX IF NOT EXISTS assignment_status_idx 
ON shift_assignment(status);

-- Composite index for time-based queries per org
CREATE INDEX IF NOT EXISTS shift_org_time_idx 
ON shift(organization_id, start_time);

-- Index for upcoming shifts query (status + time)
CREATE INDEX IF NOT EXISTS shift_status_time_idx 
ON shift(status, start_time) 
WHERE status IN ('published', 'assigned', 'in-progress');
```

**Verification:**

```sql
-- Before index
EXPLAIN ANALYZE 
SELECT * FROM shift 
WHERE organization_id = 'org-123' 
  AND status = 'published';
-- Should show Seq Scan

-- After index  
EXPLAIN ANALYZE 
SELECT * FROM shift 
WHERE organization_id = 'org-123' 
  AND status = 'published';
-- Should show Index Scan on shift_org_status_idx
```

**Dependencies:**
- None

**Risk:**
- LOW - Indexes only improve performance, won't break existing functionality

---

### TICKET WH-007: Fix Nominatim Rate Limiting Violation

**Priority:** 🟠 HIGH (P1)
**Story Points:** 1
**Epic:** Geofencing & Location
**Assignee:** Junior Backend Engineer

**Description:**

The batch geocoding function violates Nominatim's rate limit policy (max 1 request/second). Currently using 100ms delay = 10 req/sec, which will get our IP banned.

**Acceptance Criteria:**

- [ ] Increase delay to 1100ms for Nominatim provider
- [ ] Keep 100ms delay for Google Maps (they allow 50 req/sec)
- [ ] Add User-Agent header with contact email
- [ ] Add rate limit check before batch operations
- [ ] Test batch geocoding doesn't exceed limits

**Technical Details:**

File: `packages/geofence/src/utils/geocode.ts`

```typescript
// FIND THIS FUNCTION
async function geocodeWithNominatim(address: string): Promise<GeocodeResponse> {
  // ... existing code ...
  
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
    {
      headers: {
        // REPLACE THIS LINE
        'User-Agent': 'WorkersHive/1.0'
        
        // WITH THIS
        'User-Agent': 'WorkersHive/1.0 (contact@workershive.com)'
      }
    }
  );
  
  // ... rest of function
}

// FIND THIS FUNCTION
export async function geocodeAddresses(addresses: string[]): Promise<Map<string, GeocodeResponse>> {
  const results = new Map<string, GeocodeResponse>();
  
  // ADD THIS
  const provider = process.env.GEOCODING_PROVIDER || 'nominatim';
  const delayMs = provider === 'google' ? 100 : 1100; // Nominatim needs 1+ sec

  for (const address of addresses) {
    results.set(address, await geocodeAddress(address));
    
    // REPLACE THIS LINE
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
    
    // WITH THIS
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  return results;
}
```

File: `packages/geofence/src/controllers/geocode-location.ts`

```typescript
// FIND THIS SECTION (around line 95)
for (const loc of ungeocoded) {
  // ... geocoding logic ...
  
  // Rate limit
  await new Promise(resolve => setTimeout(resolve, 100));
}

// REPLACE WITH:
const provider = process.env.GEOCODING_PROVIDER || 'nominatim';
const delayMs = provider === 'google' ? 100 : 1100;

for (const loc of ungeocoded) {
  // ... geocoding logic ...
  
  // Rate limit (provider-specific)
  await new Promise(resolve => setTimeout(resolve, delayMs));
}
```

**Testing:**

```typescript
describe('Geocoding Rate Limits', () => {
  it('should respect Nominatim rate limit', async () => {
    process.env.GEOCODING_PROVIDER = 'nominatim';
    
    const addresses = [
      '100 Main St, Boston MA',
      '200 State St, Boston MA', 
      '300 Boylston St, Boston MA'
    ];
    
    const start = Date.now();
    await geocodeAddresses(addresses);
    const elapsed = Date.now() - start;
    
    // Should take at least 2.2 seconds (1.1s * 2 delays)
    expect(elapsed).toBeGreaterThan(2200);
  });
});
```

**Dependencies:**
- None

**Risk:**
- LOW - Only affects batch geocoding speed
- Better slow than IP banned

---

### TICKET WH-008: Unify CORS Configuration Across Services

**Priority:** 🟠 HIGH (P1)
**Story Points:** 2
**Epic:** Security & Infrastructure
**Assignee:** Junior Backend Engineer

**Description:**

CORS configuration is inconsistent between the shifts and geofence services. Shifts service has production URLs, geofence doesn't. Both have overly permissive `exp://` wildcards.

**Acceptance Criteria:**

- [ ] Create shared CORS config in environment variables
- [ ] Use same allowed origins in both services
- [ ] Tighten Expo deep link scheme to specific app
- [ ] Test from web app, mobile app, and postman
- [ ] Document allowed origins

**Technical Details:**

File: `.env.example` (create if doesn't exist)
```bash
# CORS Configuration
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001,https://muttonbiryani.up.railway.app,https://shift-serf.up.railway.app"
EXPO_SCHEME="workershive"  # Your actual Expo scheme
```

File: `packages/config/src/cors.ts` (create new file)
```typescript
export const getAllowedOrigins = (): string[] => {
  const origins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const expoScheme = process.env.EXPO_SCHEME || 'workershive';
  
  return [
    ...origins,
    `${expoScheme}://`,  // Specific scheme instead of exp://
  ].filter(Boolean);
};

export const corsConfig = {
  origin: getAllowedOrigins(),
  allowHeaders: ["x-org-id", "Content-Type", "Authorization"],
  allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
  credentials: true,
};
```

File: `packages/shifts/src/server.ts`
```typescript
// REPLACE THIS
app.use("*", cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://muttonbiryani.up.railway.app",
    "https://shift-serf.up.railway.app",
    "exp://",
  ],
  // ... rest of config
}));

// WITH THIS
import { corsConfig } from "@repo/config/cors";

app.use("*", cors(corsConfig));
```

File: `packages/geofence/src/server.ts`
```typescript
// SAME CHANGE
import { corsConfig } from "@repo/config/cors";

app.use("*", cors(corsConfig));
```

**Testing:**

```bash
# Test from web app
curl -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS \
  http://localhost:4005/shifts/upcoming

# Should return Access-Control-Allow-Origin: http://localhost:3000

# Test from unauthorized origin
curl -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS \
  http://localhost:4005/shifts/upcoming

# Should NOT return Access-Control-Allow-Origin header
```

**Dependencies:**
- Create `packages/config` package first

**Risk:**
- MEDIUM - May break mobile app if Expo scheme is wrong
- Test thoroughly before deploying

---

### TICKET WH-009: Implement State Machine for Shift Status Transitions

**Priority:** 🟠 HIGH (P1)
**Story Points:** 5
**Epic:** Business Logic & Validation
**Assignee:** Mid-Level Backend Engineer

**Description:**

Currently, shift status can transition illegally (e.g., `draft` → `approved`, `cancelled` → `in-progress`). We need a formal state machine to enforce valid transitions.

**Acceptance Criteria:**

- [ ] Create state machine definition
- [ ] Add validation function for transitions
- [ ] Update all shift update operations to validate transitions
- [ ] Add database constraint for valid statuses
- [ ] Add audit log when transitions are blocked
- [ ] All tests pass with new validation

**Technical Details:**

File: `packages/shifts/src/utils/state-machine.ts` (create new file)
```typescript
export type ShiftStatus = 
  | 'draft' 
  | 'published' 
  | 'assigned' 
  | 'in-progress' 
  | 'completed' 
  | 'cancelled' 
  | 'approved';

// Define valid transitions
const STATE_MACHINE: Record<ShiftStatus, ShiftStatus[]> = {
  draft: ['published', 'cancelled'],
  published: ['assigned', 'cancelled'],
  assigned: ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
  completed: ['approved'], // Can only move to approved
  cancelled: [], // Terminal state
  approved: [], // Terminal state
};

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
  from: ShiftStatus;
  to: ShiftStatus;
}

export function canTransition(
  from: ShiftStatus, 
  to: ShiftStatus
): TransitionResult {
  // Same status is always allowed (no-op)
  if (from === to) {
    return {
      allowed: true,
      from,
      to
    };
  }

  const allowedTransitions = STATE_MACHINE[from];
  
  if (!allowedTransitions) {
    return {
      allowed: false,
      from,
      to,
      reason: `Invalid current status: ${from}`
    };
  }

  if (!allowedTransitions.includes(to)) {
    return {
      allowed: false,
      from,
      to,
      reason: `Cannot transition from '${from}' to '${to}'. Allowed: ${allowedTransitions.join(', ')}`
    };
  }

  return {
    allowed: true,
    from,
    to
  };
}

// Helper for throwing errors
export function validateTransition(from: ShiftStatus, to: ShiftStatus): void {
  const result = canTransition(from, to);
  if (!result.allowed) {
    throw new Error(result.reason);
  }
}
```

File: `packages/shifts/src/controllers/approve.ts`
```typescript
import { validateTransition } from "../utils/state-machine";

// FIND THIS SECTION (around line 65)
const result = await tx.update(shift)
  .set({ status: 'approved' })
  .where(and(
    eq(shift.id, shiftId),
    inArray(shift.status, ['assigned', 'completed'])
  ));

// ADD BEFORE UPDATE
validateTransition(shiftRecord.status as ShiftStatus, 'approved');

const result = await tx.update(shift)
  .set({ status: 'approved' })
  .where(eq(shift.id, shiftId));
```

File: `packages/shifts/src/controllers/publish.ts`
```typescript
import { validateTransition } from "../utils/state-machine";

// FIND THIS SECTION (around line 75)
shiftsToInsert.push({
  id: shiftId,
  // ... other fields
  status: initialStatus,
});

// REPLACE WITH
const desiredStatus = status === 'draft' ? 'draft' : (workerId ? 'assigned' : 'published');

// Validate transition (from non-existent to initial status)
// For new shifts, we just validate the initial status is valid
if (!['draft', 'published', 'assigned'].includes(desiredStatus)) {
  throw new Error(`Invalid initial status: ${desiredStatus}`);
}

shiftsToInsert.push({
  id: shiftId,
  // ... other fields  
  status: desiredStatus,
});
```

**Database Constraint:**

```sql
-- Migration: 0009_add_status_constraints.sql

-- Add check constraint for valid statuses
ALTER TABLE shift ADD CONSTRAINT valid_shift_status 
  CHECK (status IN ('draft', 'published', 'assigned', 'in-progress', 'completed', 'cancelled', 'approved'));

-- Add check constraint for terminal states
-- (This is optional but prevents accidental updates)
```

**Testing:**

```typescript
describe('Shift State Machine', () => {
  it('should allow valid transitions', () => {
    expect(canTransition('draft', 'published').allowed).toBe(true);
    expect(canTransition('published', 'assigned').allowed).toBe(true);
    expect(canTransition('completed', 'approved').allowed).toBe(true);
  });

  it('should block invalid transitions', () => {
    const result = canTransition('draft', 'approved');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Cannot transition');
  });

  it('should allow same-status transitions', () => {
    expect(canTransition('published', 'published').allowed).toBe(true);
  });

  it('should block transitions from terminal states', () => {
    expect(canTransition('approved', 'draft').allowed).toBe(false);
    expect(canTransition('cancelled', 'published').allowed).toBe(false);
  });
});
```

**Dependencies:**
- None

**Risk:**
- MEDIUM - May block legitimate operations if state machine is too strict
- Review with product team before implementing

---

## 🟡 MEDIUM PRIORITY

### TICKET WH-010: Add Audit Log Table

**Priority:** 🟡 MEDIUM (P2)
**Story Points:** 8
**Epic:** Compliance & Observability
**Assignee:** Mid-Level Backend Engineer

**Description:**

There is no comprehensive audit trail for critical operations (shift approvals, timesheet adjustments, status changes). This is required for compliance and debugging.

**Acceptance Criteria:**

- [ ] Create `audit_log` table with Drizzle schema
- [ ] Generate and apply migration
- [ ] Implement audit logging middleware
- [ ] Log all shift status changes
- [ ] Log all timesheet adjustments
- [ ] Log all organization setting changes
- [ ] Add API endpoint to query audit logs
- [ ] Add retention policy (90 days default)

**Technical Details:**

File: `packages/database/src/schema.ts`
```typescript
export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  
  // Tenant context
  organizationId: text("organization_id")
    .references(() => organization.id, { onDelete: "cascade" }),
  
  // What was changed
  entityType: text("entity_type").notNull(), // 'shift', 'assignment', 'location', 'organization'
  entityId: text("entity_id").notNull(),
  
  // What action was performed
  action: text("action").notNull(), // 'create', 'update', 'delete', 'approve', 'cancel'
  
  // Who performed it
  userId: text("user_id")
    .references(() => user.id, { onDelete: "set null" }), // Nullable - keep logs if user deleted
  userName: text("user_name"), // Snapshot of name at time of action
  
  // What changed
  changes: json("changes").$type<{
    before: Record<string, any>;
    after: Record<string, any>;
  }>(),
  
  // Additional context
  metadata: json("metadata").$type<Record<string, any>>(),
  
  // Request context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Timestamp
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  auditOrgIdx: index("audit_org_idx").on(table.organizationId),
  auditEntityIdx: index("audit_entity_idx").on(table.entityType, table.entityId),
  auditUserIdx: index("audit_user_idx").on(table.userId),
  auditTimeIdx: index("audit_time_idx").on(table.createdAt),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  organization: one(organization, {
    fields: [auditLog.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [auditLog.userId],
    references: [user.id],
  }),
}));
```

File: `packages/observability/src/audit.ts` (create new file)
```typescript
import { db } from "@repo/database";
import { auditLog } from "@repo/database/schema";
import { nanoid } from "nanoid";

interface AuditEntry {
  organizationId?: string;
  entityType: string;
  entityId: string;
  action: string;
  userId?: string;
  userName?: string;
  changes?: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: nanoid(),
      ...entry,
      createdAt: new Date(),
    });
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('[AUDIT] Failed to log:', error);
  }
}

// Helper for shift changes
export async function logShiftChange(
  shiftId: string,
  orgId: string,
  action: string,
  userId: string,
  userName: string,
  before: any,
  after: any
): Promise<void> {
  await logAudit({
    organizationId: orgId,
    entityType: 'shift',
    entityId: shiftId,
    action,
    userId,
    userName,
    changes: { before, after },
  });
}
```

File: `packages/shifts/src/controllers/approve.ts`
```typescript
import { logShiftChange } from "@repo/observability/audit";

// ADD THIS after successful approval (around line 70)
await logShiftChange(
  shiftId,
  orgId,
  'approve',
  managerId, // Need to pass from context
  managerName,
  { status: shiftRecord.status },
  { status: 'approved' }
);
```

**API Endpoint:**

File: `packages/shifts/src/server.ts`
```typescript
app.get("/audit/:entityType/:entityId", async (c) => {
  const entityType = c.req.param("entityType");
  const entityId = c.req.param("entityId");
  const orgId = c.get("orgId");
  
  const logs = await db.query.auditLog.findMany({
    where: and(
      eq(auditLog.organizationId, orgId),
      eq(auditLog.entityType, entityType),
      eq(auditLog.entityId, entityId)
    ),
    orderBy: [desc(auditLog.createdAt)],
    limit: 100
  });
  
  return c.json(logs);
});
```

**Retention Policy:**

```typescript
// Cron job or scheduled task
async function cleanOldAuditLogs() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  await db.delete(auditLog)
    .where(lt(auditLog.createdAt, ninetyDaysAgo));
}
```

**Dependencies:**
- WH-001 (migrations must be working)

**Risk:**
- LOW - Audit logging is additive
- Performance impact minimal with proper indexes

---

### TICKET WH-011: Configure Resend Custom Domain

**Priority:** 🟡 MEDIUM (P2)
**Story Points:** 2
**Epic:** Email & Notifications
**Assignee:** Junior Backend Engineer

**Description:**

Currently using Resend's test domain `onboarding@resend.dev` for email verification. This looks unprofessional and may get flagged as spam.

**Acceptance Criteria:**

- [ ] Purchase/configure custom domain for email
- [ ] Add DNS records for Resend
- [ ] Update `FROM_EMAIL` to use custom domain
- [ ] Verify emails deliver successfully
- [ ] Test SPF/DKIM/DMARC records
- [ ] Update email templates with branding

**Technical Details:**

**DNS Records to Add:**
```
Type: TXT
Name: @
Value: v=spf1 include:resend.com ~all

Type: TXT
Name: resend._domainkey
Value: [Provided by Resend dashboard]

Type: CNAME
Name: resend
Value: feedback-smtp.resend.com
```

File: `packages/email/src/index.ts`
```typescript
// REPLACE THIS
const FROM_EMAIL = "onboarding@resend.dev";

// WITH THIS
const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@workershive.com";
```

File: `.env`
```bash
# Add this
EMAIL_FROM="WorkersHive <noreply@workershive.com>"
RESEND_API_KEY="re_xxxxxxxxxxxxx"
```

**Verification:**
```bash
# Check SPF record
dig TXT workershive.com

# Check DKIM
dig TXT resend._domainkey.workershive.com

# Send test email
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "noreply@workershive.com",
    "to": "test@youremail.com",
    "subject": "Test Email",
    "html": "<p>Testing custom domain</p>"
  }'
```

**Dependencies:**
- Access to domain registrar (GoDaddy, Namecheap, etc.)
- Resend account with custom domain feature

**Risk:**
- LOW - Worst case, emails fail and we rollback to resend.dev

---

### TICKET WH-012: Add Phone Number Validation with libphonenumber

**Priority:** 🟡 MEDIUM (P2)
**Story Points:** 3
**Epic:** Authentication & User Management
**Assignee:** Junior Backend Engineer

**Description:**

Current phone validation only supports US/Canada and Australia. Need to support international workers.

**Acceptance Criteria:**

- [ ] Replace regex validation with `libphonenumber-js`
- [ ] Support all E.164 phone formats
- [ ] Add country code detection
- [ ] Update validation error messages
- [ ] Add phone formatting utilities
- [ ] All existing phone auth tests pass

**Technical Details:**

```bash
# Install dependency
cd packages/auth
bun add libphonenumber-js
```

File: `packages/auth/src/providers/sms.ts`
```typescript
// REPLACE THIS
export const isValidPhoneNumber = (phone: string): boolean => {
  const usaCanadaRegex = /^\+1\d{10}$/;
  const australiaRegex = /^\+61\d{9}$/;
  return usaCanadaRegex.test(phone) || australiaRegex.test(phone);
};

// WITH THIS
import { parsePhoneNumber, isValidPhoneNumber as isValidE164 } from 'libphonenumber-js';

export const isValidPhoneNumber = (phone: string): boolean => {
  try {
    const parsed = parsePhoneNumber(phone);
    return parsed.isValid();
  } catch {
    return false;
  }
};

export const formatPhoneNumber = (phone: string): string | null => {
  try {
    const parsed = parsePhoneNumber(phone);
    return parsed.format('E.164'); // +14155551234
  } catch {
    return null;
  }
};

export const getCountryCode = (phone: string): string | null => {
  try {
    const parsed = parsePhoneNumber(phone);
    return parsed.country || null; // 'US', 'AU', etc.
  } catch {
    return null;
  }
};
```

Update `normalizePhoneNumber`:
```typescript
// REPLACE ENTIRE FUNCTION
export const normalizePhoneNumber = (phone: string): string => {
  // Let libphonenumber handle all the logic
  const formatted = formatPhoneNumber(phone);
  if (!formatted) {
    throw new Error('Invalid phone number format');
  }
  return formatted;
};
```

**Testing:**
```typescript
describe('Phone Validation', () => {
  it('should validate US numbers', () => {
    expect(isValidPhoneNumber('+14155551234')).toBe(true);
    expect(isValidPhoneNumber('(415) 555-1234')).toBe(true);
  });

  it('should validate international numbers', () => {
    expect(isValidPhoneNumber('+44 20 7946 0958')).toBe(true); // UK
    expect(isValidPhoneNumber('+91 98765 43210')).toBe(true); // India
    expect(isValidPhoneNumber('+86 138 0000 0000')).toBe(true); // China
  });

  it('should normalize to E.164', () => {
    expect(formatPhoneNumber('(415) 555-1234')).toBe('+14155551234');
    expect(formatPhoneNumber('020 7946 0958')).toBe('+442079460958');
  });

  it('should reject invalid numbers', () => {
    expect(isValidPhoneNumber('123')).toBe(false);
    expect(isValidPhoneNumber('not a phone')).toBe(false);
  });
});
```

**Dependencies:**
- None

**Risk:**
- LOW - Validation becomes more permissive, not more strict
- Existing valid numbers remain valid

---

### TICKET WH-013: Add Geofence Departure Notifications

**Priority:** 🟡 MEDIUM (P2)
**Story Points:** 5
**Epic:** Geofencing & Location
**Assignee:** Mid-Level Backend Engineer

**Description:**

When a worker leaves the geofence while clocked in, the assignment is flagged but no one is notified. Managers need real-time alerts.

**Acceptance Criteria:**

- [ ] Send push notification to manager when worker leaves geofence
- [ ] Send SMS to manager (optional, configurable)
- [ ] Add notification preferences table
- [ ] Create notification queue/service
- [ ] Test notification delivery
- [ ] Add retry logic for failed notifications

**Technical Details:**

File: `packages/database/src/schema.ts`
```typescript
export const notificationPreference = pgTable("notification_preference", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  
  // Preferences
  emailEnabled: boolean("email_enabled").default(true),
  smsEnabled: boolean("sms_enabled").default(false),
  pushEnabled: boolean("push_enabled").default(true),
  
  // Event subscriptions
  geofenceAlerts: boolean("geofence_alerts").default(true),
  lateClockIn: boolean("late_clock_in").default(true),
  approvalRequired: boolean("approval_required").default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

File: `packages/notifications/src/index.ts` (create new package)
```typescript
interface NotificationPayload {
  type: 'geofence_departure' | 'late_clock_in' | 'approval_required';
  organizationId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  recipientIds: string[]; // User IDs to notify
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  // Get user preferences
  const users = await db.query.user.findMany({
    where: inArray(user.id, payload.recipientIds),
    with: {
      notificationPreferences: true
    }
  });

  for (const user of users) {
    const prefs = user.notificationPreferences;
    
    // Send push if enabled
    if (prefs?.pushEnabled) {
      await sendPushNotification(user.id, payload);
    }
    
    // Send SMS if enabled
    if (prefs?.smsEnabled && user.phoneNumber) {
      await sendSMS(user.phoneNumber, payload.body);
    }
    
    // Email always sent for critical alerts
    if (payload.type === 'geofence_departure') {
      await sendEmail(user.email, payload.title, payload.body);
    }
  }
}
```

File: `packages/geofence/src/controllers/ingest-location.ts`
```typescript
import { sendNotification } from "@repo/notifications";

// FIND THIS SECTION (around line 140)
if (previousPing?.isOnSite) {
  eventType = 'departure';

  // Flag the assignment for review
  await db.update(shiftAssignment)
    .set({
      needsReview: true,
      reviewReason: 'left_geofence',
      // ... other fields
    })
    .where(eq(shiftAssignment.id, relevantAssignment.id));

  console.log(`[GEOFENCE] Worker ${workerId} left geofence without clocking out!`);
  
  // ADD THIS
  // Notify managers
  const managers = await db.query.member.findMany({
    where: and(
      eq(member.organizationId, orgId),
      inArray(member.role, ['admin', 'manager', 'owner'])
    )
  });
  
  const managerIds = managers.map(m => m.userId);
  
  await sendNotification({
    type: 'geofence_departure',
    organizationId: orgId,
    title: '⚠️ Worker Left Geofence',
    body: `${relevantAssignment.worker.name} left ${venueLocation.name} without clocking out`,
    data: {
      shiftId: relevantShift.id,
      workerId,
      assignmentId: relevantAssignment.id
    },
    recipientIds: managerIds
  });
}
```

**Push Notification Integration (Expo):**
```typescript
// packages/notifications/src/expo-push.ts
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

export async function sendPushNotification(
  userId: string,
  payload: NotificationPayload
): Promise<void> {
  // Get user's push tokens from database
  const tokens = await getUserPushTokens(userId);
  
  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error('Push notification failed:', error);
    }
  }
}
```

**Dependencies:**
- WH-001 (schema migrations)
- Expo push notification setup

**Risk:**
- MEDIUM - Notifications may be too noisy
- Add rate limiting to prevent spam

---

## 🟢 LOW PRIORITY / NICE TO HAVE

### TICKET WH-014: Extract Auth Middleware to Shared Package

**Priority:** 🟢 LOW (P3)
**Story Points:** 3
**Epic:** Code Quality & Refactoring
**Assignee:** Junior Backend Engineer

**Description:**

Auth middleware is duplicated in shifts and geofence servers. Extract to shared package to follow DRY principle.

**Acceptance Criteria:**

- [ ] Create `packages/middleware` package
- [ ] Extract auth middleware to shared location
- [ ] Update both servers to use shared middleware
- [ ] All tests pass
- [ ] No functionality changes

**Technical Details:**

File: `packages/middleware/src/auth.ts` (create new file)
```typescript
import { auth } from "@repo/auth";
import { db } from "@repo/database";
import { member } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import type { Context, Next } from "hono";

export async function authMiddleware(c: Context, next: Next) {
  // Skip health and auth routes
  if (c.req.path === "/health" || c.req.path.startsWith("/api/auth")) {
    await next();
    return;
  }

  // 1. Validate Session
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", session.user);
  c.set("session", session.session);

  // 2. Validate Tenant Context
  const orgId = c.req.header("x-org-id");
  if (!orgId) {
    return c.json({ error: "Missing Tenant Context" }, 401);
  }

  // 3. Verify Membership
  const memberRecord = await db.query.member.findFirst({
    where: and(
      eq(member.organizationId, orgId),
      eq(member.userId, session.user.id)
    ),
    columns: { id: true, role: true }
  });

  if (!memberRecord) {
    return c.json({ error: "Access Denied: Not a member of this organization" }, 403);
  }

  c.set("orgId", orgId);
  c.set("memberRole", memberRecord.role);
  
  await next();
}
```

File: `packages/shifts/src/server.ts`
```typescript
// REPLACE auth middleware code with:
import { authMiddleware } from "@repo/middleware/auth";

app.use("*", authMiddleware);
```

File: `packages/geofence/src/server.ts`
```typescript
// SAME
import { authMiddleware } from "@repo/middleware/auth";

app.use("*", authMiddleware);
```

**Dependencies:**
- None

**Risk:**
- LOW - Pure refactoring, no logic changes

---

### TICKET WH-015: Add PostGIS Extension for Geospatial Queries

**Priority:** 🟢 LOW (P3)
**Story Points:** 5
**Epic:** Performance & Optimization
**Assignee:** Senior Backend Engineer

**Description:**

Currently using Haversine formula for distance calculations. PostGIS would allow spatial indexes and more efficient queries.

**Acceptance Criteria:**

- [ ] Enable PostGIS extension on Neon database
- [ ] Migrate location coordinates to GEOGRAPHY type
- [ ] Update distance calculations to use PostGIS
- [ ] Add spatial index on location coordinates
- [ ] Benchmark performance improvement
- [ ] Update documentation

**Technical Details:**

```sql
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Migrate location table
ALTER TABLE location 
  ADD COLUMN coordinates GEOGRAPHY(POINT, 4326);

-- Populate from existing lat/lng
UPDATE location 
SET coordinates = ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326);

-- Add spatial index
CREATE INDEX location_coordinates_idx 
ON location USING GIST(coordinates);

-- Example query - find nearby locations
SELECT id, name, 
  ST_Distance(
    coordinates, 
    ST_SetSRID(ST_MakePoint(-71.0589, 42.3601), 4326)
  ) / 1000 as distance_km
FROM location
WHERE ST_DWithin(
  coordinates,
  ST_SetSRID(ST_MakePoint(-71.0589, 42.3601), 4326),
  5000  -- 5km radius
)
ORDER BY distance_km;
```

**Dependencies:**
- WH-003 (coordinate type migration)
- Neon database with PostGIS support

**Risk:**
- MEDIUM - Requires database migration
- Keep Haversine as fallback

---

### TICKET WH-016: Add Request Timeout Handling

**Priority:** 🟢 LOW (P3)
**Story Points:** 2
**Epic:** Reliability & Error Handling
**Assignee:** Junior Backend Engineer

**Description:**

Long-running requests (geocoding, batch operations) can timeout without proper error handling.

**Acceptance Criteria:**

- [ ] Add timeout middleware to Hono servers
- [ ] Set reasonable timeout limits (30s for API, 5min for batch)
- [ ] Add timeout handling to geocoding calls
- [ ] Return proper error responses
- [ ] Log timeout events

**Technical Details:**

File: `packages/middleware/src/timeout.ts`
```typescript
import type { Context, Next } from "hono";

export function timeoutMiddleware(timeoutMs: number = 30000) {
  return async (c: Context, next: Next) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
    });

    try {
      await Promise.race([next(), timeoutPromise]);
    } catch (error) {
      if (error instanceof Error && error.message === 'Request timeout') {
        return c.json({ 
          error: 'Request timeout',
          message: `Request took longer than ${timeoutMs}ms` 
        }, 504);
      }
      throw error;
    }
  };
}
```

Usage:
```typescript
import { timeoutMiddleware } from "@repo/middleware/timeout";

// Apply to all routes
app.use("*", timeoutMiddleware(30000)); // 30 seconds

// Or specific routes
app.post("/schedules/publish", 
  timeoutMiddleware(60000), // 1 minute for batch
  async (c) => { /* ... */ }
);
```

**Dependencies:**
- WH-014 (shared middleware package)

**Risk:**
- LOW - Additive feature, improves reliability

---

## 📋 EPIC SUMMARY

### Critical Path to Production (Must Do)
1. WH-001: Fix Schema Drift
2. WH-002: Remove Currency Field
3. WH-003: Fix Coordinate Types
4. WH-004: Break Enforcement
5. WH-005: Clock-Out Race Condition

**Total Story Points:** 22
**Estimated Time:** 2-3 sprints (4-6 weeks)

### High Priority (Should Do)
6. WH-006: Add Indexes
7. WH-007: Fix Nominatim Rate Limits
8. WH-008: Unify CORS
9. WH-009: State Machine

**Total Story Points:** 13
**Estimated Time:** 1-2 sprints

### Medium Priority (Nice to Have)
10. WH-010: Audit Log
11. WH-011: Custom Email Domain
12. WH-012: Phone Validation
13. WH-013: Departure Notifications

**Total Story Points:** 18
**Estimated Time:** 2 sprints

### Low Priority (Future)
14-16: Refactoring & Optimization

**Total Story Points:** 10

---

## 🎯 RECOMMENDED SPRINT PLAN

### Sprint 1 (High Priority - Production Blockers)
- WH-001: Schema Drift (5 pts) 🔴
- WH-002: Currency Field (1 pt) 🔴
- WH-006: Add Indexes (2 pts) 🟠
- WH-007: Nominatim Rate Limit (1 pt) 🟠

**Total: 9 points**

### Sprint 2 (Critical Features)
- WH-003: Coordinate Types (8 pts) 🔴
- WH-004: Break Enforcement (5 pts) 🔴

**Total: 13 points**

### Sprint 3 (Stability & Polish)
- WH-005: Race Condition (3 pts) 🔴
- WH-008: CORS Config (2 pts) 🟠
- WH-009: State Machine (5 pts) 🟠

**Total: 10 points**

### Sprint 4+ (Enhancement)
- WH-010: Audit Log (8 pts) 🟡
- WH-011: Email Domain (2 pts) 🟡
- WH-012: Phone Validation (3 pts) 🟡
- WH-013: Notifications (5 pts) 🟡

---

## 📊 DEPENDENCY GRAPH

```
WH-001 (Schema Drift)
  ├─→ WH-002 (Currency)
  ├─→ WH-003 (Coordinates)
  └─→ WH-010 (Audit Log)

WH-003 (Coordinates)
  └─→ WH-015 (PostGIS)

WH-014 (Shared Middleware)
  ├─→ WH-008 (CORS)
  └─→ WH-016 (Timeout)

Independent:
- WH-004 (Break Enforcement)
- WH-005 (Race Condition)
- WH-006 (Indexes)
- WH-007 (Rate Limit)
- WH-009 (State Machine)
- WH-011 (Email Domain)
- WH-012 (Phone Validation)
- WH-013 (Notifications)
```

---

## 💡 NOTES FOR PRODUCT MANAGER

1. **Critical Path:** WH-001 through WH-005 MUST be completed before production launch
2. **Quick Wins:** WH-002, WH-006, WH-007 are low-effort, high-impact
3. **User Impact:** WH-004 (break enforcement) may reduce worker pay - communicate clearly
4. **Compliance:** WH-010 (audit log) required for SOC2/GDPR eventually
5. **Performance:** Current system works but won't scale past 1000 shifts/day without WH-006
