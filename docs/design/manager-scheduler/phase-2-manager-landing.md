# Manager Scheduler — Phase 2: The Manager's First Ten Seconds

> **Superseded in part by [phase 3](./phase-3-redesign.md).** Phase 3 makes the scheduler touch-first, replaces the "Needs you"
> strip with a plain-text weeks-ahead row and Inbox, and replaces phone triage with a real Day / Week / Month on phones. The landing
> redirect (§1) and the time-aware landing-week rule (§2) still stand.

Extends [`phase-1-plan.md`](./phase-1-plan.md). Phase 1 built the weekly Scheduler grid. This
document designs what a manager sees and can do **from the moment they log in**.

## Context

The grid works. The entry to it does not.

- `/dashboard` redirects to `/dashboard/shifts`, the old Shifts card list
  (`apps/web/app/(protected)/dashboard/page.tsx:16`). The nav logo links there too
  (`apps/web/components/nav-header.tsx:61`). The Scheduler is one click away, so the
  primary surface is not the first one.
- The Scheduler toolbar counters (open slots, requests) describe **one week at one
  location**. Nothing says that next week is unpublished, that another location has open
  shifts, or that timesheets are waiting.
- `schedule/page.tsx` always opens `locations[0]` on the current week. It remembers nothing
  and knows nothing about what day it is.
- The nav has no mobile version (`nav-header.tsx:136` is a placeholder). Managers check
  from their phones, and the grid is desktop-only by phase-1 decision.

**Outcome:** a manager logs in and lands on the right week, at the right location, already
knowing what needs them, with each item one click from the action. On a phone, they get a
triage view for the short jobs: approve, fill, publish.

## Decisions (confirmed with owner)

| Decision | Choice |
|---|---|
| Landing surface | `/schedule`, with a slim "Needs you" strip. No separate Home page. |
| Devices | Full grid on desktop (≥1024px). Triage view on phones. No editable grid on phones. |
| Deliverable now | This spec only. No app code. |

## Principles

Each principle rules out something specific. When a design choice below is contested, these decide it.

1. **The grid is home.** Attention items are doors into the grid. They are not a dashboard the
   manager must clear before working.
2. **Quiet when healthy.** If nothing is outside the current view, the strip does not render.
   A tool that always shows a banner teaches people to ignore banners.
3. **Every signal is a verb with a count.** One click lands where the action is possible:
   filtered, scrolled, highlighted.
4. **Never delay the grid.** Attention data loads after first paint and fails silently.
5. **Time-aware.** The right week on Thursday is not the right week on Monday.
6. **One owner per counter.** The toolbar owns in-view counts. The strip owns everything
   outside the view. If a chip ever repeats a toolbar counter, delete the chip.

## 1. Entry: route and redirect

| Change | Where |
|---|---|
| After the onboarding check, `/dashboard` redirects to `getSchedulerHref()` instead of the Shifts list. | `apps/web/app/(protected)/dashboard/page.tsx` |
| The nav logo links to `/schedule`. Shifts stays in the nav as a secondary list. | `apps/web/components/nav-header.tsx` |
| Login keeps its `/dashboard` default. It flows through the redirect, so nothing else changes. | `apps/web/components/auth/login-form.tsx` |

**Roles.** `apps/web/lib/server/auth-context.ts` exposes no role, and the web app has no
client-side role gate. Redirecting every role is acceptable: `schedule/page.tsx:58` already
converts a manager-only 403 into a notice. What changes is the notice copy. It should say
where the worker's shifts are ("Your shifts are in the Workers Hive app on your phone") and
offer a way to get there. Do not build role-aware routing in this phase.

## 2. Which week and which location

### Location
Precedence: explicit `?location=` → last location this manager used → first location.

The remembered location is stored in a **cookie**. `schedule/page.tsx` is a server component,
so `localStorage` would not be readable when the page picks a location.

### Week
Precedence: explicit `?week=` → the landing rule below.

The landing rule is one pure function, `pickLandingWeek`, in
`packages/scheduling-timekeeping/src/domain/week.ts`, unit-tested against the org's
`weekStartsOn` and the location's timezone. Let `d` be today's index in the week (0–6 from
`weekStartsOn`).

1. This week has unpublished changes → **this week**.
2. Else next week has drafts (the manager stopped there) → **next week**.
3. Else `d ≥ 4` (the last three days) and next week has no shifts → **next week**.
4. Else → **this week**.

**An auto-jump is never silent.** A chip beside the week arrows reads
`Showing next week · Back to this week`. Trade-off: any auto-jump can surprise someone, and
this one will, occasionally. The visible chip and the one-click way back are the mitigation.
If early feedback is negative, the fallback is rule 4 only, with the strip carrying the
"next week" chip. That is a one-line change because the rule lives in one function.

## 3. Desktop (≥1024px)

```
Workers Hive   Schedule  Shifts  Roster  Reports                        Trial · 🔔 · Ana
Needs you   ● Next week · 14 shifts not published →   ● Uptown · 4 open, 2 requests →   ● 5 timesheets to approve →   ×
Downtown ▾  ‹ Sep 27 – Oct 3 ›   [All] [Front of house] [Kitchen]     6 open · 4 requests · 1 conflict   ⋯   [Publish 6]
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 🔍 Find person    Sun 27   Mon 28   Tue 29 …                       (existing grid, unchanged)
```

### 3.1 The "Needs you" strip

- **Size and tone:** 36px tall, muted background. It informs. It does not alarm. Red is
  reserved for blocking conflicts, which stay in the grid and toolbar.
- **Count:** at most three chips, then a `+N more` popover.
- **Behavior:** every chip is a real link with a deep link, so it works with middle-click,
  back/forward and copy-link. Chips are keyboard-focusable. Dismissal is per chip until
  tomorrow (`localStorage`, wrapped in try/catch; the strip renders correctly without it).
- **Empty:** renders nothing.
- **Order:** by how soon it costs the manager something.

| Chip | Shows when | Copy | Click goes to |
|---|---|---|---|
| Other week | The viewed week is not the week the manager is likely to worry about: viewing this week and next week has drafts or is empty, or viewing next week and this week has open slots | `Next week · 14 shifts not published` / `This week · 3 open` | `?week=` of that week, same location |
| Other location | Another location has open slots, requests or unpublished changes | `Uptown · 4 open, 2 requests` | `?location=` |
| Timesheets | Approval count > 0 **and** the Approve action works (see §7) | `5 timesheets to approve` | `/dashboard/shifts`, approval filter |

### 3.2 Toolbar additions

The toolbar keeps its two counters exactly as built (open slots scroll to and highlight the
Open row; requests open the Requests panel). One addition:

- **Conflicts counter** (`1 conflict`, red text, only when > 0). `SchedulerWeek.summary`
  (`packages/contracts/src/scheduler.ts:174`) has no conflict count, so this is computed
  client-side from the loaded week using the same logic that draws the red **!** on chips.
  Clicking it focuses the first conflicted chip; repeated clicks step to the next. This
  reuses the "Review" jump pattern from the publish dialog.

### 3.3 Location select

When another location needs attention, the location select shows a small dot. The strip says
what; the dot says where, without opening the menu.

## 4. Phone triage (<1024px)

Below `lg`, `/schedule` renders triage in place of the grid.

**Why not a responsive grid:** a people-by-days grid with drag and drop cannot be edited well
on a phone, and forcing it produces a slow, error-prone experience. The manager's phone jobs
are short and few.

```
┌ Downtown ▾               Tue Sep 29 ┐
│ ┌ Needs you ─────────────────────┐ │
│ │ Ben · swap Fri 4p–11p   [No][Yes]│ │   inline decide; shows the impact
│ │   ⚠ Would be at 44h              │ │   ("Ben would be at 44h"), as the desktop panel does
│ │ Cara · time off Oct 3   [No][Yes]│ │
│ ├ Open shifts ───────────────────┤ │
│ │ Fri 4p–11p · 3× Server    Fill ›│ │   opens the ranked "Who can take it" sheet
│ │ Sat 11a–5p · 1× Cook      Fill ›│ │
│ ├ This week ─────────────────────┤ │
│ │ Tue · 9 shifts · 2 open        ›│ │   read-only day list; a shift opens the shift sheet
│ │ Wed · 11 shifts                ›│ │
│ └────────────────────────────────┘ │
│ [ Publish 6 changes ]   (sticky)    │   same publish dialog, as a bottom sheet
│ Schedule · Requests · Roster · More │   bottom tab bar
└─────────────────────────────────────┘
```

- **Reused, not rebuilt:** the requests list and approve/decline endpoints (`/scheduler/requests`),
  the ranked candidates logic (`apps/web/lib/scheduler/candidates.ts`), the publish preview
  and dialog content (`publish-dialog.tsx`), and the shift sheet content.
- **Single-shift edits are allowed** (time, role, who). Building a whole week is not. The view
  says so once, in the empty-state footer ("To build the week, use a computer"), and never
  nags.
- **Bottom tab bar** fills the nav placeholder. Tabs: Schedule · Requests (with the same
  badge as the desktop nav) · Roster · More (Shifts, Reports, Settings).
- **Deferred to phase 2b:** a "Today" card (who is on now, who is late, who has not clocked
  in). It is the strongest morning signal for a manager, but it needs clock-in data in the
  overview. It fits the phase-1 deferral of the day timeline.

## 5. States

Every state needs a wireframe and final copy in the build ticket. The intent for each:

| State | What the manager sees |
|---|---|
| **Healthy** | No strip. Toolbar reads `0 open · 0 requests`. Publish is grey. Nothing performs "all clear" theatre. |
| **Loading** | Grid skeleton from the server render. Strip streams in after first paint. No layout shift: the strip's slot is reserved only once data proves it will render. |
| **Overview fails** | Strip hidden. Grid unaffected. No error toast: the strip is a convenience, not a dependency. |
| **No location** | Existing "Add a location first" notice, with the button (already built). |
| **No team yet** | One line above an empty grid: `Add your team to start scheduling` → Roster. |
| **Empty week** | Existing one-liner: `Nothing scheduled yet · Copy last week · Use a template`. |
| **Multi-location** | Location select dot (§3.3). Chip for the other location. |
| **Auto-jumped week** | `Showing next week · Back to this week` beside the arrows. |
| **Worker on web** | Notice from §1. |
| **Offline / stale** | Strip data older than 5 minutes shows a subtle "updated 6 min ago"; SWR revalidates on focus. |

## 6. Data: what exists, what is new

**Exists**

- `SchedulerWeek.summary` → `{ openSlots, pendingChangeCount, pendingRequestCount }`
  (`packages/contracts/src/scheduler.ts:174`). Per location, per week.
- `GET /scheduler/requests/summary` → `{ pending }`
  (`RequestsSummarySchema`, `packages/contracts/src/requests.ts:168`). The nav badge calls
  it without a location.
- `getPendingShiftsCount` (`apps/web/lib/api/shifts.ts:75`), which feeds today's `ApprovalBanner`.
- `apps/web/lib/scheduler/client.ts` exports `REQUESTS_SUMMARY_KEY` and `fetchRequestsSummary`,
  the SWR pattern to copy.

**New: `GET /scheduler/overview`** (manager-gated like the rest of `/scheduler`)

```ts
SchedulerOverview = {
  locations: {
    locationId: string; name: string;
    thisWeek: WeekSignals; nextWeek: WeekSignals;
  }[];
  /** Claims, drops, swaps, time off waiting, org-wide. */
  pendingRequestCount: number;
  /** Completed shifts awaiting approval, org-wide. */
  timesheetsToApprove: number;
  suggestedLanding: { locationId: string; weekStart: LocalDate };
};
WeekSignals = { weekStart: LocalDate; shiftCount: number; openSlots: number; pendingChangeCount: number };
```

- **Aggregate counts, not full weeks.** Loading a full `SchedulerWeek` per location to get
  three numbers would be wasteful. This is a `GROUP BY`, not a view model.
- **Cap and measure.** Cap the locations returned (start at 10) and measure the query before
  shipping.
- **Layering** (from `docs/architecture/api-first-backend-blueprint.md`): contract in
  `packages/contracts/src/scheduler.ts` → use case
  `packages/scheduling-timekeeping/src/modules/scheduler/get-overview.ts` (calls
  `pickLandingWeek`) → thin route in `apps/api/src/routes/scheduler.ts` → SWR client in
  `apps/web/lib/scheduler/client.ts`. `apps/web` never imports `@repo/database`.
- **Tests:** `pickLandingWeek` (all four rules, week boundaries, `weekStartsOn` 0 and 1,
  location timezone crossing midnight); the use case with mocked rows; the route (manager
  allowed, member 403).

The landing choice is computed **server-side in `schedule/page.tsx`**, so the first paint is
already the right week. The strip is fetched **client-side** so it never blocks that paint.

## 7. Risks and honest calls

- **The Timesheet Approve button is dead today.** Phase 1 logged it as out of scope, and it
  is still true: `apps/web/app/(protected)/dashboard/shifts/[shiftId]/timesheet/client.tsx`
  renders `ShiftDetailView` without `onApprove`. A chip that sends managers to a button that
  does nothing is worse than no chip. **The Timesheets chip ships only after that is fixed.**
- **Cross-location is deferred in phase 1** ("cross-location view"). The Other location chip
  is a deliberately small step: counts and a link, no cross-location grid.
- **Multi-location cost.** The overview must stay aggregate. If it does not, cut to the
  remembered location plus a single org-wide count.
- **Auto-jump surprise.** Covered in §2, with a defined fallback.
- **Strip and toolbar overlap.** Principle 6. Review at each addition.
- **Next.js version.** `apps/web/AGENTS.md` warns that this version has breaking changes.
  Before implementing the redirect or anything touching `proxy.ts`, read the relevant guide
  in `node_modules/next/dist/docs/`. This spec makes no version-specific API claims.
- **Role handling is thin.** Redirecting all roles relies on the 403 notice. That is fine
  while workers are mobile-only. Revisit if workers ever use the web app.

## 8. Build order

Each step ships and is useful alone.

1. **Entry:** redirect, nav logo, remembered-location cookie. Small, and the biggest single
   improvement.
2. **`pickLandingWeek`** with unit tests, wired into `schedule/page.tsx` with the
   `Showing next week` chip.
3. **Overview:** contract, use case, route and tests.
4. **Strip** and toolbar **conflicts counter**, with the location dot.
5. **Phone triage** and bottom tab bar.
6. **Timesheets chip**, after the Approve fix.
7. **Playwright** `scheduler.spec.ts` covering login → landing → chip → action. Phase 1 names
   these tests, but none exist yet.

## 9. Measuring it

PostHog is already in the stack. Events:

- `manager_landing_viewed` `{ week_relation: this|next|explicit, auto_jumped, device }`
- `attention_chip_clicked` `{ type }`
- `attention_chip_dismissed` `{ type }`

Questions the data should answer:

- Does time from login to first publish or first request decision fall?
- Which chips get clicked, and which are dismissed without ever being clicked (cut those)?
- How often does a manager click `Back to this week` right after an auto-jump? A high rate
  means the jump rule is wrong.

## 10. Alternatives considered

| Option | Why not (now) |
|---|---|
| Dedicated Home page (Today, Needs you, Next week cards) | Puts a screen between the manager and the grid. Stronger for multi-location owners: revisit if orgs commonly run more than ~3 locations. |
| Right-hand inbox rail on the Scheduler | Costs grid width, which 50-person weeks need (phase-1 §2.1a). |
| Keep Shifts as landing plus banners | Smallest change, but it keeps the manager off the primary surface. |
| Fully responsive editable grid | Highest cost and the hardest layout to get right on a phone. Triage covers the real phone jobs. |

## 11. Open questions for the owner

1. Is the week auto-jump acceptable, or should it be opt-in from Settings → Scheduling?
2. Which managers should get the Other location chip: everyone, or only owners and admins?
3. Should `Today` (who is late or not clocked in) be pulled into phase 2, ahead of phone
   triage? It needs clock data but would help a manager most in the morning.
