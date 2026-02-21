# WorkersHive Clock-In/Out Flow — Gap Analysis & Implementation Spec

**Example Shift: 9:00 AM – 5:00 PM**

---

## 1. YOUR RULES vs CURRENT CODE

### RULE 1: Arrival Detection → "Clock in when ready" notification
**Scenario:** Worker arrives at 8:45 AM (within geofence, before shift start)

| Aspect | Your Rule | Current Code | Status |
|--------|-----------|--------------|--------|
| Detect arrival via background ping | ✅ Required | ✅ `ingest-location.ts:125-133` detects arrival, sends SMS | **WORKING** |
| Notification type | Push notification "Arrived at location, clock in when ready" | SMS only — no push notification | **GAP** |
| Trigger condition | Worker inside geofence + no clock-in yet + within buffer window | ✅ Checks `isOnSite && !actualClockIn` | **WORKING** |

**Fix needed:**
- `ingest-location.ts:129-132` — Currently sends SMS only. Add push notification via `@repo/notifications` alongside SMS. The device token infrastructure already exists (`deviceToken` table + `push-notifications.ts` service).

---

### RULE 2: Worker Self Clock-In → effectiveClockIn = scheduled start time
**Scenario:** Worker clocks in at 8:50 AM via mobile. Effective start = 9:00 AM (not 8:50)

| Aspect | Your Rule | Current Code (geofence/clock-in.ts) | Status |
|--------|-----------|--------------------------------------|--------|
| actualClockIn | Store real time (8:50 AM) | `applyClockInRules()` returns `recordedTime = actualTime` → stored as `actualClockIn` | **WORKING** |
| effectiveClockIn | Always snap to scheduled start (9:00 AM) when early | **NOT SET** — `clock-in.ts` never sets `effectiveClockIn` at all | **BUG** |
| Geofence enforcement | Must be at location | ✅ Hard block if outside geofence (line 104-109) | **WORKING** |
| Early buffer | Allow clock-in within configurable window (default 60 min) | ✅ `earlyClockInBufferMinutes` from org config (line 121) | **WORKING** |

**Critical bug:** `geofence/src/services/clock-in.ts` line 136-143 only sets `actualClockIn` but never sets `effectiveClockIn`. The `effectiveClockIn` column stays `NULL`. This means:
- The timesheet DTO returns no effective time
- Duration calculations in `approve.ts` use `effectiveClockIn` and will get wrong numbers
- The mobile app can't show the "official" start time

**Fix needed in `clock-in.ts` transaction (line 136-143):**
```typescript
await tx.update(shiftAssignment)
    .set({
        actualClockIn: clockInResult.recordedTime,    // 8:50 AM (real time)
        effectiveClockIn: scheduledStart,              // 9:00 AM (always snap to schedule for worker self-clock-in)
        clockInPosition: sql`ST_GeogFromText(${point})`,
        clockInVerified: true,
        clockInMethod: 'geofence',
        status: 'active',  // not 'in-progress' yet — see Rule note below
        updatedAt: now,
    })
    .where(eq(shiftAssignment.id, assignment.id));
```

**Note on status:** Currently sets no assignment status on clock-in. The shift status transitions to `in-progress` but the *assignment* status stays `active`. This is actually fine — the assignment is `active` until completed.

---

### RULE 3: Worker Self Clock-Out → allowed any time, must be at location
**Scenario:** Worker done at 4:00 PM, clocks out via mobile

| Aspect | Your Rule | Current Code (geofence/clock-out.ts) | Status |
|--------|-----------|---------------------------------------|--------|
| Allow early clock-out | Yes, worker can leave at 4:00 PM (before 5:00 PM) | ✅ No time restriction on clock-out | **WORKING** |
| Geofence enforcement | Must be at location | ✅ Hard block if outside geofence (line 102-108) | **WORKING** |
| effectiveClockOut | Store actual time (4:00 PM) | `applyClockOutRules()` returns actual time | **WORKING** |
| Race condition guard | Prevent double clock-out | ✅ `isNull(shiftAssignment.actualClockOut)` guard (line 133) | **WORKING** |

**Minor fix:** `clock-out.ts` stores `clockOutResult.recordedTime` as `actualClockOut` but doesn't set `effectiveClockOut`. Add:
```typescript
effectiveClockOut: clockOutResult.recordedTime,  // 4:00 PM actual
```

---

### RULE 4: Post Clock-Out → Worker can request time corrections
**Scenario:** Worker clocked out at 4:00 PM but actually worked until 4:30 PM

| Aspect | Your Rule | Current Code | Status |
|--------|-----------|--------------|--------|
| Submit correction request | After clock-out, worker can request updated clock-in/out | ✅ `request-correction.ts` — full workflow | **WORKING** |
| Prevent duplicate requests | Only one pending request per assignment | ✅ Checks existing pending (line 50-61) | **WORKING** |
| Flag assignment for review | Mark `needsReview` | ✅ Sets `needsReview: true, reviewReason: 'disputed'` | **WORKING** |
| Manager approval flow | Manager reviews and approves/rejects | ✅ `review-correction.ts` exists | **WORKING** |

**No changes needed** — this flow is solid.

---

### RULE 5: Manager Clock-In → effectiveClockIn = actual arrival time (NOT snapped)
**Scenario:** Worker arrives at 8:30 AM, manager puts them to work. Manager clocks in at 8:30 AM. Effective start = 8:30 AM (not 9:00 AM).

| Aspect | Your Rule | Current Code (manager-override.ts) | Status |
|--------|-----------|-------------------------------------|--------|
| Manager can set clock-in time | Yes, any time (including before shift start) | ✅ Accepts `clockIn` timestamp | **PARTIAL** |
| effectiveClockIn = actual time | 8:30 AM (no snapping to 9:00 AM) | ❌ Sets `clockIn` (wrong column name) and never sets `effectiveClockIn` | **BUG** |
| Permission check | Only admin/manager/owner | ✅ Role check (line 32) | **WORKING** |
| Audit trail | Record who made the override | ✅ Sets `adjustedBy` and `adjustedAt` | **PARTIAL — no audit_event row** |

**Bugs in `manager-override.ts`:**

1. **Wrong column names (line 59, 64):** Uses `clockIn` and `clockOut` which don't exist on the schema. Should be `actualClockIn`/`actualClockOut` AND `effectiveClockIn`/`effectiveClockOut`.

2. **References removed column (line 54):** `adjustmentNotes` was removed from schema (comment on line 329 of schema.ts says "adjustmentNotes REMOVED - Use assignment_audit_events"). This will throw a runtime error.

3. **No audit event created:** Unlike `clock-in.ts` which creates an `assignmentAuditEvent`, the manager override creates none. Per your architecture, overrides should be audit-logged.

4. **No snapping logic distinction:** When a manager clocks in a worker, both `actualClockIn` AND `effectiveClockIn` should be the manager-specified time (8:30 AM). No snapping to schedule.

**Fix needed — rewrite `manager-override.ts`:**
```typescript
const updateData: Record<string, any> = {
    updatedAt: now,
    adjustedBy: managerId,
    adjustedAt: now,
    needsReview: false,
    clockInMethod: 'manual_override',
};

if (clockIn !== undefined) {
    const clockInDate = clockIn ? new Date(clockIn) : null;
    updateData.actualClockIn = clockInDate;
    updateData.effectiveClockIn = clockInDate;  // NO SNAPPING for manager override
    updateData.clockInVerified = false;
    updateData.clockInMethod = 'manual_override';
}

if (clockOut !== undefined) {
    const clockOutDate = clockOut ? new Date(clockOut) : null;
    updateData.actualClockOut = clockOutDate;
    updateData.effectiveClockOut = clockOutDate;  // NO SNAPPING for manager override
    updateData.clockOutVerified = false;
    updateData.clockOutMethod = 'manual_override';
}

// Add audit event
await db.insert(assignmentAuditEvent).values({
    id: nanoid(),
    assignmentId: shiftAssignmentId,
    actorId: managerId,
    previousStatus: assignment.status,
    newStatus: assignment.status, // status doesn't change on override
    metadata: {
        action: 'manager_override',
        clockIn, clockOut, breakMinutes, notes,
        reason: notes || 'Manager adjustment'
    },
    timestamp: now,
});
```

---

### RULE 6: Missing Clock-In/Out → Show ⚠️ bang sign for manager action
**Scenario:** Worker forgot to clock in or out. Show warning icon next to missing times.

| Aspect | Your Rule | Current Code | Status |
|--------|-----------|--------------|--------|
| Detect missing clock-in | Shift ended, no `actualClockIn` | Partially — `approveShift` marks as `no_show` | **NEEDS UI** |
| Detect missing clock-out | Has `actualClockIn` but no `actualClockOut` | `approveShift` auto-fills with scheduled end | **NEEDS UI + FLAG** |
| Visual indicator (⚠️) | Show bang/warning icon next to missing times | Not implemented in web or mobile UI | **GAP** |
| Manager can update later | Manager fills in times after shift | ✅ `manager-override.ts` allows setting times | **WORKING** (once bugs fixed) |

**What needs to happen:**

**A. Backend — Add `timesheetFlags` to the DTO**

In `worker-shifts.ts` mapper and in the web admin shift detail endpoint, compute flags:

```typescript
// In the DTO mapper
timesheetFlags: {
    missingClockIn: !assignment.actualClockIn && shiftHasEnded,
    missingClockOut: !!assignment.actualClockIn && !assignment.actualClockOut && shiftHasEnded,
    needsReview: assignment.needsReview,
    reviewReason: assignment.reviewReason,
}
```

**B. Web Admin UI — Show ⚠️ icons**

On the shift detail / timesheet view, next to each worker's row:
- If `missingClockIn` → show ⚠️ next to start time cell with tooltip "No clock-in recorded"
- If `missingClockOut` → show ⚠️ next to end time cell with tooltip "No clock-out recorded"
- Both flags → make the row highlighted/amber to draw manager attention
- Clicking the ⚠️ opens the manager override form pre-filled with the assignment

**C. Mobile Worker App — Show ⚠️ in shift history**

On completed shift cards where clock-in/out is missing, show warning badge.

---

## 2. DUPLICATE CODE PROBLEM

There are **two parallel clock-in implementations:**

| File | Location | Used By |
|------|----------|---------|
| `packages/geofence/src/services/clock-in.ts` | Full implementation with geofence, anti-spoofing, audit, notifications | Hono API routes |
| `packages/shifts/src/modules/time-tracking/service.ts` | `AssignmentService.clockIn()` — softer geofence check, different snapping logic | Unclear — may be dead code |

**Same for clock-out:** `geofence/clock-out.ts` vs `shifts/service.ts clockOut()`

The `geofence/` versions are the correct ones — they have proper validation, anti-spoofing, geofence enforcement, location recording, audit logging, and notification cleanup. The `shifts/service.ts` versions are legacy and should be marked as deprecated or removed.

**Recommendation:** Delete `AssignmentService.clockIn()` and `clockOut()` from `shifts/service.ts`, or refactor them to delegate to the geofence versions. Keep `AssignmentService.updateTimesheet()`, `getAssignment()`, and `updateStatus()` as they serve different purposes.

---

## 3. SUMMARY OF ALL FIXES

### P0 — Breaking / Data Integrity

| # | Fix | File | Impact |
|---|-----|------|--------|
| 1 | Set `effectiveClockIn = scheduledStart` on worker self clock-in | `geofence/services/clock-in.ts:136-143` | Duration/pay calculations wrong without this |
| 2 | Set `effectiveClockOut` on worker self clock-out | `geofence/services/clock-out.ts:122-128` | Duration calculations wrong |
| 3 | Fix column names in manager override (`clockIn` → `actualClockIn`/`effectiveClockIn`) | `geofence/services/manager-override.ts:59,64` | Runtime crash — columns don't exist |
| 4 | Remove `adjustmentNotes` reference (column was removed from schema) | `geofence/services/manager-override.ts:54` | Runtime crash |
| 5 | Fix timesheet DTO mapping (`assignment.clockIn` → `assignment.actualClockIn`) | `shifts/modules/time-tracking/worker-shifts.ts:141-142` | Mobile app never shows clock-in/out status |

### P1 — Business Logic

| # | Fix | File | Impact |
|---|-----|------|--------|
| 6 | Manager override: both actual + effective = specified time (no snapping) | `geofence/services/manager-override.ts` | Early starts underpaid |
| 7 | Manager override: add `assignmentAuditEvent` row | `geofence/services/manager-override.ts` | No audit trail for manual changes |
| 8 | Arrival detection: add push notification alongside SMS | `geofence/services/ingest-location.ts:129-132` | Workers only get SMS, not push |
| 9 | Add `timesheetFlags` to shift DTOs (missing clock-in/out indicators) | `shifts/modules/time-tracking/worker-shifts.ts` | No way to show ⚠️ icons |

### P2 — Cleanup

| # | Fix | File | Impact |
|---|-----|------|--------|
| 10 | Remove or deprecate duplicate `AssignmentService.clockIn/clockOut` | `shifts/modules/time-tracking/service.ts` | Confusion, divergent logic |
| 11 | Fix role check in manager-override (schema only has `admin`/`member`, not `manager`/`owner`) | `geofence/services/manager-override.ts:32` | Only `admin` can override currently |

---

## 4. COMPLETE FLOW DIAGRAM

```
8:30 AM  Manager puts worker to work
         └─ Manager Override: actualClockIn=8:30, effectiveClockIn=8:30
            (no snapping, trust the manager's time)

8:45 AM  Worker arrives at location (background ping)
         └─ ingest-location detects arrival (isOnSite + !actualClockIn)
         └─ Push notification: "You've arrived! Clock in when ready"
         └─ SMS: "Arrived at [venue], please clock in"

8:50 AM  Worker taps "Clock In" on mobile
         └─ Geofence check: MUST be inside radius (hard block)
         └─ Anti-spoofing: device time within 5min, GPS accuracy < 200m
         └─ actualClockIn = 8:50 AM (real time, for audit)
         └─ effectiveClockIn = 9:00 AM (snapped to scheduled start)
         └─ Shift status → 'in-progress'

4:00 PM  Worker taps "Clock Out" on mobile
         └─ Geofence check: MUST be inside radius (hard block)
         └─ actualClockOut = 4:00 PM
         └─ effectiveClockOut = 4:00 PM (no snapping on clock-out)
         └─ Assignment status → 'completed'

4:15 PM  Worker realizes they forgot break time
         └─ Opens shift history → "Request Adjustment"
         └─ Submits correction: requestedBreakMinutes = 30
         └─ Assignment flagged: needsReview = true

5:00 PM  Shift ends. Worker who forgot to clock in/out:
         └─ ⚠️ shown next to missing times in manager dashboard
         └─ Manager clicks ⚠️ → override form
         └─ Manager fills in actual times → saved with audit trail

LATER    Manager approves shift
         └─ Grace period snapping (5-min buffer)
         └─ Break enforcement (30-min mandatory for 6+ hours)
         └─ Duration calculated from effective times
         └─ No-shows marked automatically
```
