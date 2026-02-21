# WorkersHive Phase 1: Production Readiness Gap Analysis
## Target: Scheduling app like When I Work (NOT marketplace)

---

## WHAT YOU HAVE (62 routes)

```
✅ = Working       ⚠️ = Stub/partial       ❌ = Missing (no route)
```

### Auth & Session (handled by Better Auth)
- ✅ POST /api/auth/sign-up/email
- ✅ POST /api/auth/sign-in/email  
- ✅ POST /api/auth/sign-in/phone (SMS OTP via Twilio)
- ✅ GET  /api/auth/session
- ✅ POST /api/auth/sign-out

### Shifts (13 routes) — CORE, mostly working
- ✅ POST /shifts/publish (recurring dates, idempotency, notifications)
- ✅ GET  /shifts/upcoming
- ✅ GET  /shifts/pending-approval
- ✅ GET  /shifts/history
- ✅ GET  /shifts/drafts
- ✅ DELETE /shifts/drafts
- ✅ GET  /shifts/groups/{groupId}
- ✅ GET  /shifts/{id}
- ✅ POST /shifts/{id}/approve
- ✅ POST /shifts/{id}/cancel
- ✅ POST /shifts/{id}/assign
- ✅ GET  /shifts/{id}/timesheets
- ✅ PATCH /shifts/{shiftId}/timesheet

### Geofence / Clock (9 routes) — CORE, all working after patches
- ✅ POST /geofence/clock-in
- ✅ POST /geofence/clock-out
- ✅ POST /geofence/location (background pings — NEW)
- ✅ POST /geofence/manager-override (NEW)
- ✅ GET  /geofence/flagged (NEW)
- ✅ POST /geofence/corrections
- ✅ GET  /geofence/pending
- ✅ POST /geofence/review
- ⚠️ POST /geofence/verify-location (stub 501)

### Worker-Facing (7 routes) — partial
- ✅ GET  /worker/shifts
- ✅ POST /worker/availability
- ✅ GET  /worker/availability
- ✅ POST /worker/adjustments
- ⚠️ GET  /worker/adjustments (returns empty [])
- ⚠️ GET  /worker/profile (partial mock)
- ⚠️ PATCH /worker/profile (stub 501)

### Organizations / Crew (11 routes) — all wired to services
- ✅ GET  /organizations/crew
- ✅ POST /organizations/crew/invite
- ✅ PATCH /organizations/crew/{id}
- ✅ DELETE /organizations/crew/{id}
- ✅ POST /organizations/crew/{id}/reactivate
- ✅ GET  /organizations/locations
- ✅ POST /organizations/locations
- ✅ PATCH /organizations/locations/{id}
- ✅ DELETE /organizations/locations/{id}
- ✅ PATCH /organizations/settings
- ✅ GET  /organizations/settings

### Reports (5 routes) — working
- ✅ GET  /timesheets
- ✅ GET  /timesheets/filters
- ✅ GET  /timesheets/export
- ✅ GET  /timesheets/export/csv
- ✅ GET  /timesheets/export/pdf

### Devices (3 routes) — working
- ✅ POST /devices/register
- ✅ GET  /devices
- ✅ DELETE /devices/{tokenId}

### Preferences (4 routes) — working
- ✅ GET/PATCH /preferences
- ✅ GET/PATCH /manager-preferences

### Billing (10 routes) — ALL STUBS
- ⚠️ Everything returns 501 or empty []

---

## PHASE 1 FEATURE MAP vs WHEN I WORK

| Feature | When I Work | WorkersHive Status | Routes Needed |
|---------|------------|-------------------|---------------|
| **Create/publish shifts** | ✅ | ✅ Working | 0 |
| **Recurring shifts** | ✅ | ✅ recurrence.ts exists | 0 |
| **Assign workers to shifts** | ✅ | ✅ Working | 0 |
| **View upcoming/past shifts** | ✅ | ✅ Working | 0 |
| **Cancel shifts** | ✅ | ✅ Working | 0 |
| **Approve timesheets** | ✅ | ✅ Working | 0 |
| **Clock in/out with GPS** | ❌ (no GPS) | ✅ PostGIS geofencing | 0 |
| **Manager time corrections** | ✅ | ✅ Working (just added) | 0 |
| **Worker availability** | ✅ | ✅ Working | 0 |
| **Time correction requests** | ✅ | ✅ Working | 0 |
| **Crew/worker management** | ✅ | ✅ Working | 0 |
| **Location management** | ✅ | ✅ Working | 0 |
| **Timesheet reports/CSV export** | ✅ | ✅ Working | 0 |
| **SMS notifications** | ✅ | ⚠️ Publish inserts to scheduledNotification, but no cron processes them | **1** |
| **Push notifications** | ✅ | ⚠️ Expo SDK + device tokens exist, no dispatch endpoint | **1** |
| **Edit published shift** | ✅ | ❌ No edit endpoint | **1** |
| **Unassign worker** | ✅ | ❌ No unassign endpoint | **1** |
| **Worker views own corrections** | ✅ | ⚠️ Returns empty [] | **fix only** |
| **Worker profile update** | ✅ | ⚠️ Stub 501 | **fix only** |
| **Bulk worker import (CSV)** | ✅ | ❌ Service exists, no route | **1** |
| **Shift duplication** | ✅ | ❌ No route | **1** |
| **Open/unfilled shifts view** | ✅ | ❌ No route | **1** |
| **Shift swap/trade** | ✅ | ❌ Not built | Phase 2 |
| **Team messaging** | ✅ | ❌ Not built | Phase 2 |
| **Labor cost tracking** | ✅ | ❌ Price removed | Phase 2 |
| **Overtime alerts** | ✅ | ❌ Not built | Phase 2 |
| **Multi-location dashboard** | ✅ | ⚠️ Org-scoped, no cross-location view | Phase 2 |
| **Billing/subscription** | ✅ | ❌ All stubs | Phase 2 |

---

## NEW ROUTES NEEDED FOR PHASE 1

### MUST HAVE (7 new routes + 2 fixes)

#### 1. `PATCH /shifts/{id}` — Edit Published Shift
Right now you can publish and cancel, but you can't edit a shift after publishing. If the venue changes the time from 5 PM to 6 PM, you'd have to cancel and republish. Every scheduling app has this.

**Service needed:** `updateShift(shiftId, orgId, updates)` — new service
**Complexity:** Medium. Need to handle: time change → notify assigned workers, capacity change → validate against current assignments, location change → update geofence reference.

#### 2. `DELETE /shifts/{id}/assign/{workerId}` — Unassign Worker
You can assign workers but can't remove them. If a worker calls in sick, you need to unassign and assign a replacement.

**Service needed:** `unassignWorker(shiftId, workerId, orgId)` — new service
**Complexity:** Low. Delete from shiftAssignment, update capacity.filled, notify worker.

#### 3. `POST /shifts/{id}/duplicate` — Duplicate Shift
Copy a past shift as a new draft. Standard scheduling workflow: "same event next week."

**Service needed:** `duplicateShift(shiftId, orgId, newDate)` — new service  
**Complexity:** Low. Read shift + assignments, insert new shift with new dates.

#### 4. `GET /shifts/open` — Open/Unfilled Shifts
Shifts where `capacity.filled < capacity.total`. Managers need this to know what still needs staffing.

**Service needed:** Can piggyback on existing `getUpcomingShifts` with a filter
**Complexity:** Low. SQL where clause addition.

#### 5. `POST /organizations/crew/bulk-import` — Bulk Worker Import
Service exists (`bulkImport`, `importParser`), web UI exists (`/rosters/import`), but no API route connects them.

**Service needed:** Already built in `packages/shifts/src/modules/workers/bulk-import.ts`
**Complexity:** Low. Just wire the route to the existing service.

#### 6. `POST /notifications/process` — Process Pending Notifications
The publish flow inserts rows into `scheduledNotification` table, but nothing ever reads and sends them. You need either a cron endpoint or a background worker.

**Service needed:** `packages/notifications/src/services/expo-push.ts` has `sendBatchNotifications`. Just needs a trigger.
**Complexity:** Medium. Need to: query pending notifications where `sendAt <= now`, call Expo push API, mark as sent/failed. Can be a simple endpoint called by Railway cron or an external cron service.

#### 7. Fix `GET /worker/adjustments` — Return Worker's Own Corrections
Currently returns empty `[]`. Need to query `timeCorrectionRequest` where `workerId = user.id`.

**Service needed:** `getWorkerCorrections(workerId, orgId)` — new simple query
**Complexity:** Low.

#### 8. Fix `PATCH /worker/profile` — Worker Profile Update  
Currently returns 501. Workers need to update their phone number, name, etc.

**Service needed:** Update `user` table fields
**Complexity:** Low.

---

### NICE TO HAVE (5 routes — ship without these initially)

#### 9. `POST /geofence/verify-location` — Server-Side Location Check
Currently 501. The mobile app has a client-side Haversine fallback, but server-side PostGIS is more accurate.

#### 10. `GET /shifts/{id}/audit` — Shift Audit Trail
View all changes to a shift (who edited, who clocked in/out, overrides). Data exists in `assignmentAuditEvent` and `auditLog` tables.

#### 11. `POST /notifications/test` — Send Test Notification
Admin tool to verify push notifications are working for a specific device.

#### 12. `GET /worker/notifications` — Worker Notification History
List past notifications sent to the worker.

#### 13. `POST /shifts/{id}/notes` — Shift Notes
Add notes to a shift (e.g., "Dress code: all black", "Park in lot B"). No table exists yet — needs a `shiftNote` table or a `notes` text column on `shift`.

---

## SUMMARY

```
Current working routes:     52 (of 62 total, 10 are stubs)
New routes for Phase 1:      7 (new endpoints)
Fixes for Phase 1:           2 (worker adjustments + profile)
────────────────────────────────
Phase 1 total:              61 working routes

Nice-to-have:                5 (can ship without)
```

### PRIORITY ORDER (what to build next)

| Priority | Route | Why | Effort |
|----------|-------|-----|--------|
| **P0** | `POST /notifications/process` | Without this, no worker ever gets notified about shifts. Publish writes to DB but nothing sends. | 2-3 hrs |
| **P0** | `PATCH /shifts/{id}` (edit shift) | Can't fix a wrong time after publishing without cancel+republish | 3-4 hrs |
| **P0** | `DELETE /shifts/{id}/assign/{workerId}` (unassign) | Can't handle call-outs | 1 hr |
| **P1** | Fix `GET /worker/adjustments` | Workers submit corrections but can't see their status | 30 min |
| **P1** | Fix `PATCH /worker/profile` | Workers can't update their info | 30 min |
| **P1** | `POST /organizations/crew/bulk-import` | Service exists, just needs route | 30 min |
| **P2** | `POST /shifts/{id}/duplicate` | Convenience, not blocking | 1 hr |
| **P2** | `GET /shifts/open` | Can filter in UI as workaround | 30 min |

**Total estimated effort for P0+P1: ~8 hours of focused work.**
