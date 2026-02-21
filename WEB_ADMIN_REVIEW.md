# WorkersHive Web Admin (`apps/web`) — Code Review

---

## ARCHITECTURE OVERVIEW

**Stack:** Next.js 14 (App Router) + Server Actions + SWR + shadcn/ui + TanStack Table + Sonner toasts

**Data flow:**
```
Page (RSC) → getShifts() server action → fetch() to Hono API → shifts-service package → DB
                                           ↑
Client component → server action → same fetch() path
```

**Route structure:**
- `/dashboard` → redirects to `/dashboard/shifts`
- `/dashboard/shifts` → ShiftsView (tabbed: Upcoming / Past with Action Required)
- `/dashboard/shifts/[shiftId]/timesheet` → ShiftDetailView with TimesheetTable
- `/reports` → Timesheet export with SWR
- `/rosters` → Worker management
- `/settings` → Org settings

---

## CRITICAL BUGS

### 1. `TimesheetWorker` type is missing `needsReview` / `timesheetFlags` — ⚠️ icons can't render

**File:** `packages/shifts/src/types.ts` (line 32-43)

The shared `TimesheetWorker` type doesn't carry any flag data. The `get-timesheets.ts` mapper (line 29-45) strips everything except `clockIn`, `clockOut`, `breakMinutes`, `status`. There's no way for the web admin to know if a worker's timesheet needs review or has missing punches.

**Fix:** Extend `TimesheetWorker` type:

```typescript
export interface TimesheetWorker {
    id: string;
    name: string;
    avatarUrl?: string;
    avatarInitials: string;
    role: string;
    clockIn?: string;
    clockOut?: string;
    effectiveClockIn?: string;
    effectiveClockOut?: string;
    breakMinutes: number;
    totalDurationMinutes?: number;
    status: 'rostered' | 'new' | 'blocked' | 'submitted' | 'approved' | 'no-show' | 'cancelled';
    // NEW: flags for manager dashboard
    needsReview: boolean;
    reviewReason?: string;
    clockInMethod?: string;
    clockOutMethod?: string;
}
```

### 2. `get-timesheets.ts` doesn't return review flags

**File:** `packages/shifts/src/modules/time-tracking/get-timesheets.ts` (line 29-45)

The mapper only returns `clockIn`/`clockOut`/`breakMinutes`/`status`. It doesn't pass through `needsReview`, `reviewReason`, `clockInMethod`, `clockOutMethod`, or `totalDurationMinutes`. The manager has zero visibility into which workers need attention.

**Fix:** Extend the mapper return:

```typescript
return {
    id: a.id,
    name: workerName,
    avatarUrl: a.worker?.image || undefined,
    avatarInitials: getInitials(workerName),
    role: "Worker",
    clockIn: (a.effectiveClockIn || a.actualClockIn)?.toISOString() ?? undefined,
    clockOut: (a.effectiveClockOut || a.actualClockOut)?.toISOString() ?? undefined,
    effectiveClockIn: a.effectiveClockIn?.toISOString() ?? undefined,
    effectiveClockOut: a.effectiveClockOut?.toISOString() ?? undefined,
    breakMinutes: a.breakMinutes || 0,
    totalDurationMinutes: a.totalDurationMinutes ?? undefined,
    status: mapAssignmentStatus(a.status as string),
    needsReview: a.needsReview || false,
    reviewReason: a.reviewReason ?? undefined,
    clockInMethod: a.clockInMethod ?? undefined,
    clockOutMethod: a.clockOutMethod ?? undefined,
};
```

### 3. `getWorkerStatus()` uses hardcoded time comparisons

**File:** `apps/web/lib/timesheet-utils.ts` (line 32-58)

The status logic for highlighting clock-in/out cells is comparing against hardcoded `"05:00 PM"` strings. This was placeholder code from a mock and will flag every real worker as "Late" (destructive red) regardless of their actual shift time.

```typescript
// THIS IS BROKEN:
} else if (worker.clockIn !== "05:00 PM" && worker.clockIn !== "05:00 AM") {
    clockInVariant = "destructive"; // Late = Red   ← ALWAYS FIRES
}
```

**Fix:** Rewrite to compare against actual shift times and use the `needsReview` flag:

```typescript
export const getWorkerStatus = (
    worker: Partial<TimesheetViewModel>,
    shiftStartTime?: string,
    shiftEndTime?: string
): TimesheetStatus => {
    let clockInVariant: StatusVariant = "default";
    let clockOutVariant: StatusVariant = "default";
    let breakVariant: StatusVariant = "default";

    // Missing = destructive (red)
    if (!worker.clockIn) {
        clockInVariant = "destructive";
    } else if (worker.needsReview) {
        clockInVariant = "warning"; // Flagged for review = amber
    }

    if (!worker.clockOut) {
        clockOutVariant = "destructive";
    } else if (worker.needsReview) {
        clockOutVariant = "warning";
    }

    if (!worker.breakDuration || worker.breakDuration === "0 min") {
        breakVariant = "warning"; // Missing break = amber, not red
    }

    return { clockInVariant, clockOutVariant, breakVariant };
};
```

### 4. `totalHours` is hardcoded mock value

**File:** `apps/web/components/shifts/shift-detail-view.tsx` (line 121)

```typescript
const totalHours = "19 hrs, 34 mins";  // HARDCODED MOCK
```

This is displayed in the approval footer as the total hours for the shift. It never changes regardless of actual worker clock data.

**Fix:** Calculate from worker data:

```typescript
const totalMinutes = workers.reduce((sum, w) => {
    if (w.clockIn && w.clockOut) {
        const start = new Date(parseTimeStringToIso(w.clockIn, new Date(shift.startTime)) || '');
        const end = new Date(parseTimeStringToIso(w.clockOut, new Date(shift.startTime)) || '');
        const breakMins = parseInt(w.breakDuration) || 0;
        const mins = Math.max(0, (end.getTime() - start.getTime()) / 60000 - breakMins);
        return sum + mins;
    }
    return sum;
}, 0);
const hours = Math.floor(totalMinutes / 60);
const mins = Math.round(totalMinutes % 60);
const totalHours = `${hours} hrs, ${mins} mins`;
```

### 5. `ShiftSummaryHeader` uses hardcoded values

**File:** `apps/web/components/shifts/shift-detail-view.tsx` (line 270-280)

```typescript
<ShiftSummaryHeader
    role="Event Staff"              // HARDCODED
    breakDuration="30 min break"    // HARDCODED
    createdBy="Admin"               // HARDCODED
    createdAt="Oct 14, 11:37 PM"    // HARDCODED
/>
```

None of these come from actual data. `role` should be `shift.title`, `breakDuration` should be computed, `createdBy`/`createdAt` should come from the shift record.

### 6. `ShiftDetailView` doesn't actually call approve API

**File:** `apps/web/components/shifts/shift-detail-view.tsx` (line 315)

```typescript
<ShiftApprovalFooter
    onApprove={() => onApprove?.()}  // Just calls prop
/>
```

When rendered from the timesheet page (`/dashboard/shifts/[shiftId]/timesheet`), the `onApprove` prop is never passed:

```typescript
// client.tsx line 16-21
<ShiftDetailView
    shift={shift}
    timesheets={timesheets}
    onBack={() => router.back()}
    // onApprove is MISSING — button does nothing
/>
```

**Fix:** Add approve handler to the timesheet client page.

### 7. `updateTimesheet` passes `action` as string but always sends `'update_time'`

**File:** `apps/web/components/shifts/shift-detail-view.tsx` (line 153)

```typescript
let action = 'update_time';  // never changes
```

The `mark_no_show` action path is never reachable from the UI. There's no "No Show" button anywhere in the timesheet row or table.

---

## MODERATE ISSUES

### 8. No ⚠️ icons in TimesheetRow for missing clock-in/out

The `timesheet-row.tsx` component renders TimePicker inputs for clock-in/out but has no visual indicator when values are missing and the shift has ended. The `destructive` variant adds a red border to the input, but there's no ⚠️ icon or "Missing" label that a manager would notice at a glance.

### 9. `hasErrors` blocks approval even when override is the right action

**File:** `apps/web/components/shifts/shift-detail-view.tsx` (line 115-117)

```typescript
const hasErrors = workers.some(
    (w) => !w.clockIn || !w.clockOut || !w.breakDuration
);
```

If a worker forgot to clock in (which is your ⚠️ scenario), the approve button is disabled. But the manager's workflow should be: see ⚠️ → fill in times → then approve. Currently, the manager can fill in times (via TimePicker), but the `hasErrors` check re-evaluates on render and should clear when times are filled. This part works, but the UX doesn't guide the manager to understand WHY approval is blocked.

### 10. `window.location.reload()` after adding workers

**File:** `apps/web/components/shifts/shift-detail-view.tsx` (line 102)

```typescript
window.location.reload();  // Heavy-handed, loses scroll position
```

Should use `router.refresh()` (Next.js soft refresh) instead.

### 11. `ShiftCodeBanner` component exists but is never rendered

**File:** `apps/web/components/shifts/timesheet/shift-code-banner.tsx`

This component for showing shift verification codes is built but never imported or used in any page or layout. Dead code.

### 12. Duplicate orgId resolution logic (4 copies)

The same "get orgId from session, fallback to DB query" pattern exists in:
1. `apps/web/app/(protected)/layout.tsx` (line 21-31)
2. `apps/web/app/(protected)/dashboard/shifts/page.tsx` (line 33-50)
3. `apps/web/lib/api/shifts.ts` → `getSecureOrgId()` (line 11-36)
4. `apps/web/app/(protected)/reports/page.tsx` via hook

Should be consolidated into a single `getActiveOrgId()` utility.

### 13. Reports page is client-side only (`"use client"`)

**File:** `apps/web/app/(protected)/reports/page.tsx`

The entire reports page is a client component using SWR. This means the initial page load shows loading skeletons, and the data is fetched client-side without SSR. For an admin dashboard, this is suboptimal — the shift list page uses RSC for initial data which is the right pattern.

### 14. `updateTimesheet` sends time as `"hh:mm a"` format, backend expects ISO

**File:** `apps/web/components/shifts/shift-detail-view.tsx` (line 179-193)

The `parseTimeStringToIso` helper converts `"05:00 PM"` back to ISO. This round-trip is fragile:
- TimePicker displays `format(date, "hh:mm a")`
- User edits in that format
- `parseTimeStringToIso` reconstructs the date using `shift.startTime` as base
- If the clock-out is after midnight (next day), the date base is wrong → time goes to the previous day

---

## MINOR / CLEANUP

### 15. Duplicate `// apps/web/lib/api/shifts.ts` comment (line 38-40)
### 16. `createdAt` in ShiftSummaryHeader should be dynamic
### 17. No loading state when fetching timesheets in ShiftsView (line 61)
### 18. `calendarView` receives `isLoading={false}` hardcoded
### 19. No error boundary on shift detail page

---

## PRIORITY FIX ORDER

### P0 — Data display is wrong

| # | Fix | Files |
|---|-----|-------|
| 1 | Extend `TimesheetWorker` type with `needsReview`, `reviewReason`, effective times | `packages/shifts/src/types.ts` |
| 2 | Return review flags + effective times from `get-timesheets.ts` | `packages/shifts/src/modules/time-tracking/get-timesheets.ts` |
| 3 | Remove hardcoded `"05:00 PM"` comparison in `getWorkerStatus()` | `apps/web/lib/timesheet-utils.ts` |
| 4 | Calculate real `totalHours` instead of `"19 hrs, 34 mins"` | `apps/web/components/shifts/shift-detail-view.tsx` |
| 5 | Wire up `onApprove` in timesheet client page | `apps/web/app/(protected)/dashboard/shifts/[shiftId]/timesheet/client.tsx` |

### P1 — Missing ⚠️ UX for manager workflow

| # | Fix | Files |
|---|-----|-------|
| 6 | Add ⚠️ icon + "Missing" label in TimesheetRow when clock-in/out is empty post-shift | `apps/web/components/shifts/timesheet/timesheet-row.tsx` |
| 7 | Add "No Show" button to TimesheetRow or table actions | `timesheet-row.tsx` + `shift-detail-view.tsx` |
| 8 | Replace hardcoded ShiftSummaryHeader values with real data | `shift-detail-view.tsx` |
| 9 | Add `TimesheetViewModel.needsReview` field for ⚠️ badge rendering | `apps/web/lib/timesheet-utils.ts` |

### P2 — Technical debt

| # | Fix | Files |
|---|-----|-------|
| 10 | Replace `window.location.reload()` with `router.refresh()` | `shift-detail-view.tsx` |
| 11 | Consolidate orgId resolution into single utility | Multiple |
| 12 | Fix midnight clock-out date base bug in `parseTimeStringToIso` | `timesheet-utils.ts` |
| 13 | Remove dead `ShiftCodeBanner` or wire it up | `shift-code-banner.tsx` |
