# Manager Scheduler Rebuild — Phase 1 Plan

## Context
Manager scheduling in `apps/web` was built on Instawork's marketplace model: a shift
is a *posting* with slots, created blind through a long form on a separate page.
Customers are in-house crews — retail, restaurants — plus businesses running variable
events. The product isn't live, so the owner chose **scrap and rebuild** over patching.
Workers stay **mobile-only** (Expo). The owner likes the Shifts dashboard; the
schedule-building experience is what gets replaced.

**Outcome:** one fast, spreadsheet-grade weekly Scheduler (people × days) where
managers build, fix and publish a week without leaving the grid. Events and
headcount-per-role are first-class, conflicts and labor are visible inline, and
workers can claim, drop, swap and request time off from their phones.

## Decisions (confirmed with owner)
- **Keep untouched:** Shifts *list* view (cards, banners, summary) and the shift
  detail/timesheet page (`dashboard/shifts/[shiftId]/timesheet`).
- **Replace:** Weekly day-rows view, `/dashboard/schedule/create`, and schedule
  building/assigning → one new **Scheduler** at `/schedule`.
- **Depth:** new UI + reshaped scheduling API/contracts; DB changed only where the
  design needs it (additive migration).
- **Phase 1 scope:** build/publish week · hours & overtime per person · labor cost ·
  open shifts claimable on mobile · time-off & swap requests with manager approval.
- **Architecture:** follow `docs/architecture/api-first-backend-blueprint.md`:
  contract (`packages/contracts`) → use case (`packages/scheduling-timekeeping`) →
  thin Hono route (`apps/api`) → UI. `apps/web` never imports `@repo/database`.

---

## 1. What the current scheduling UX is (audit)

```
┌ ← Create a Schedule ─────────────────────────── [Review & Publish] ┐
│ Work Location   [Location ▾]            [Manager(s) ▾] (required)  │
│ Build your schedule                          Recurring schedule [○] │
│ ┌ Date & Times ──────────────────────────────────────────────────┐ │
│ │ [Schedule name]  [Select date(s) 📅]                           │ │
│ │ [Start ▾] [End ▾] [Total unpaid break ▾]                       │ │
│ │ Positions: [Bartender · Ana ×] [Server · open ×]               │ │
│ │ [+ Add position] → 600px modal: search, custom role, role tabs,│ │
│ │                   crew list "Add", "Add open slot", Done       │ │
│ └────────────────────────────────────────────────────────────────┘ │
│ [ + Add schedule block ]                  Cancel  [Review & Publish]│
└────────────────────────────────────────────────────────────────────┘
```
1. **Building blind.** The form never shows the week, the people, or their hours.
   You see the result only after publishing, on another page.
2. **No person axis anywhere.** The weekly view is day rows × shift strips
   (`weekly-grid-view.tsx`). Crew `hours` is hard-coded 0
   (`packages/gig-workers/src/modules/directory/get-crew.ts:70`), so the "overtime"
   badge (hard-coded `>40`) never fires. `regional_overtime_policy` is never read
   when scheduling.
3. **Headcount costs clicks.** "Add open slot" closes the modal every time: five
   open bartender slots means opening the modal five times.
4. **Marketplace leftovers.**
   - The required onsite-manager field sends only `managerIds[0]`.
   - The recurring toggle applies to every block.
   - Duplicate block does nothing.
   - The break field is never sent to the API.
5. **Destructive, org-wide drafts.**
   - The create page preloads *every* org draft into one form, and publishing
     creates copies of them.
   - "Discard" calls `DELETE /shifts/drafts`, which deletes every draft in the org,
     including copied weeks.
6. **Inconsistent server rules.**
   - Only publish checks overlap and availability strictly.
   - Assign checks them partly, and its availability check isn't scoped to the org.
   - Edit, copy-week, apply-template and publish-drafts check nothing.
7. **Timezone drift.** The grid, date grouping and draft→form conversion use the
   viewer's timezone, not the location's.
8. **No labor data.** No rate reaches the shift (`budgetRateSnapshot` is always
   null), so cost can't be shown.
9. **Broken open-shift promise.** Publish copy says open slots are claimable. But
   `GET /shifts/open` is shadowed by `GET /shifts/{id}`, and the worker app has no
   open-shifts screen.
10. **Notifications are uneven.** Assign queues no "new shift" push. Invited and
    agency workers are never reachable, yet the review dialog counts them as
    "notified".

---

## 2. The new Scheduler — UX design

Research basis: the patterns below recur across When I Work, 7shifts, Deputy,
Homebase, Sling, HotSchedules and Workstaff. The design also avoids the complaints
managers most often raise about those tools:
- having to re-enter details when moving a shift;
- a forced "copy week?" prompt;
- no audit trail;
- no notification to managers about claims;
- "publish all" re-notifying everyone;
- time off shown as hours instead of times.

### 2.1 Layout (desktop ≥1024px; `/schedule?location=&week=&group=`)
```
┌ Schedule  [Downtown ▾]  ‹  Oct 6 – 12  ›  [Today]   Group: (People|Roles)   [Tools ▾]  [Requests 3]  [Publish 14 changes] ┐
├ Open slots 5 · Scheduled 412h · Overtime 2 people · Labor $6,120 · 3 people missing a rate ───────────────────────────────┤
│ Search people… [Role ▾] [Scheduled only ☐]│ Sun 6     │ Mon 7        │ Tue 8     │ … │ Sat 12              │ Week      │
│ EVENTS                                    │           │              │           │   │ Smith Wedding 4–11p │           │
│                                           │           │              │           │   │ ●●●○○ 5/8  (amber)  │           │
│ OPEN SHIFTS                               │           │ 2× Server    │           │   │ 3× Server (event)   │ 5 open    │
│                                           │           │  5–11p       │           │   │                     │           │
│ ▾ SERVERS                                 │           │              │           │   │                     │           │
│   Ana Ruiz      Server · $18              │ 9a–5p     │ [+]          │ TIME OFF  │   │ 4–11p ◆Wedding      │ 38h $684  │
│   Ben Kim       Server                    │ 10a–6p ⚠  │ 5–11p        │ ░unavail░ │   │                     │ 44h ⚠OT   │
│ ▾ BARTENDERS                              │           │              │           │   │                     │           │
│   Cara Diaz     Invited (no app)          │ ╱draft╱   │              │           │   │                     │ 16h       │
│ ▸ AGENCY (1)                              │           │              │           │   │                     │           │
├───────────────────────────────────────────┼───────────┼──────────────┼───────────┼───┼─────────────────────┼───────────┤
│ Day total                                 │ 58h $1,020│ 64h $1,130   │ …         │   │ 96h $1,700          │ 412h $6.1k│
└───────────────────────────────────────────┴───────────┴──────────────┴───────────┴───┴─────────────────────┴───────────┘
```
- **Sticky header and first column.** The week always starts on the org's
  `weekStartsOn`. All dates and times are in the **location's** timezone.
- **Grouping.**
  - **People** (default): rows are employees grouped by primary role. An Open
    Shifts row sits on top, above an Events lane.
  - **Roles**: rows are roles. Cells show each shift with fill (`2/3`), avatars and
    open count. This is the view for variable events.
- **Chip states.**

  | State | Look |
  |---|---|
  | Draft | Diagonal stripes |
  | Published | Solid role color |
  | Published with unpublished edits | Solid, plus an amber "changed" dot |
  | Conflict | Corner icon: red = overlap/time off, amber = unavailable/overtime/role mismatch; tooltip explains |
  | Overridden conflict | Keeps the icon, marked "scheduled anyway" (audited) |
  | Event shift | ◆ event tag |

- **Row end:** weekly hours and cost. Amber within 4h of the overtime threshold;
  red over it. Tooltip includes hours at other locations.
- **Day footer:** hours and cost per day. The stats bar gives week totals.
- **Time off & availability:** approved time off fills the cell with its exact
  times. Pending time off is hatched. Unavailable windows are shaded.
- **Empty week:** an inline strip offers **Copy last week · Apply template · Start
  from scratch**. It never blocks navigation.

### 2.2 Interactions
| Action | Behavior |
|---|---|
| Create | Click an empty cell (or Enter on a focused cell) → **quick-create popover**. |
| Quick-create fields | Time field accepts `9-5`, `9a-5:30p`, `17-23`, `10-2` (overnight aware). Role defaults to the row's role; break select; "Note to staff". "More" expands capacity, event and manager-only note. Enter saves as a draft; Tab moves to the next cell. |
| Edit | Click a chip → right **Shift drawer** (Sheet). Fields: time, role, break, capacity, notes (staff / manager-only), event. **Assignees** list plus ranked **candidates**. Actions: duplicate ×N, save as template, delete/cancel, "Open timesheet" (links to the kept detail page). |
| Candidates | Ranked qualified-first: role match, no conflict, hours this week, cost. Each row shows why it isn't recommended ("On time off 2–6p", "Puts her at 44h"). Choosing a flagged person asks **"Schedule anyway"**, which is audited. |
| Move | Drag a chip to another cell, person or day. The shift keeps all its details. |
| Copy | **Alt/Option-drag**, or `c` / `v` on a focused chip. |
| Unassign / assign | Drag to the Open row = unassign (the slot stays open). Drag from Open onto a person = assign. |
| Keyboard | Arrow keys move focus · Enter opens · `c` / `v` / `Delete` · `z` undo / `Shift+z` redo · `n` new open shift · `?` shortcut overlay. |
| Undo | Every grid operation has an inverse. An "Undone / Redo" toast plus an undo stack for the session. |
| Headcount | Capacity is a number field ("How many"). Open slots render as one chip reading "3× Server". |
| Events | Tools → "Add event", or click the Events lane. **Event drawer:** name, date, time window, notes, and role lines (role × headcount × optional time override). This creates the event plus one shift per role line. The lane shows fill with red/amber/green rollup. Staffing uses the same candidate list or drag. |
| Tools menu | Copy last week (options: include people / as open shifts) · Apply template · Save week's shifts as template · Discard unpublished changes (this week and location only). |
| Publish | The button shows the pending count and is grey when there is nothing to publish. The dialog shows: new / changed / removed shifts; the named people who will be notified (one batched push each, **only people with changes**); the named invited/agency people who can't be reached ("tell them yourself"); open slots that become claimable; and unresolved conflicts, with "Review" jumping to each one. Scope is **this location + this week**. |
| Requests | The toolbar button (and a badge on the "Schedule" nav item) opens a right panel. Tabs: Time off · Swaps & drops · Open-shift claims. Each card shows the exact times and the impact ("creates 1 open slot Tue", "puts Ben at 44h"). Approve / Decline with a note. |

### 2.3 Edit model: a working copy until publish (7shifts/When I Work behavior; supports Fair Workweek)
- New shifts are **drafts**, invisible to workers.
- Edits to a **published** shift are staged:
  - Time, role, break, capacity and notes go in `shift.pendingPatch`.
  - Assignee adds and removes go in `shift_assignment.pendingState`.
  - Deletes stage `pendingPatch.cancel`.
- Workers keep seeing the last published version.
- **Publish** applies everything, writes an audit entry, and sends one batched
  notification per affected person.
- **Discard unpublished changes** clears the staging for that location and week.
- Edits made from the kept detail page still apply live (current behavior). They
  also clear any staged fields they overwrite.

### 2.4 Mobile worker additions (Expo, `apps/gig-workers`)
- **Tabs:** My shifts · **Open** · **Requests** · Profile.
- **Open:**
  - Lists published open slots for roles the worker holds, at their orgs.
  - Claim → auto-assign or pending, depending on org policy. Conflicts are
    explained before claiming.
- **Shift detail:** add **Drop** (release to open shifts; needs approval when
  policy says so) and **Swap** (offer to a named qualified coworker; the coworker
  accepts, then the manager approves when policy says so).
- **Requests:**
  - My time off: "+ New" with dates, all-day or exact times, and a reason.
  - Swap offers sent to me (accept / decline).
  - Status of my claims and drops.
- **Pushes:**
  - Schedule published/changed (batched).
  - New open shift for my role.
  - Claim, drop, swap and time-off decisions.
  - Swap offered to me.

---

## 3. Data model changes (Drizzle, `packages/database/src/schema.ts`, one additive migration)

**Changes to existing tables**

| Table | Change |
|---|---|
| `organization` | Add `weekStartsOn` smallint default 0 · `openShiftClaimPolicy` text `'approval'\|'auto'` default `'approval'` · `swapApprovalRequired` boolean default true |
| `shift` | Add `breakMinutes` int default 0 · `eventId` → `schedule_event` (nullable, set null on delete) · `pendingPatch` jsonb null · `managerNote` text · `publishedAt` timestamptz. Keep `description` as the staff note. Stop overloading `scheduleGroupId` (legacy only). |
| `shift_assignment` | Add `pendingState` text null (`'add'\|'remove'`). Write `budgetRateSnapshot` at publish. |

**New tables**
- **`schedule_event`:** id, organizationId, locationId, name, startTime, endTime,
  notes, createdBy, timestamps.
- **`shift_request`:**
  - id, organizationId, `type` (`claim\|drop\|swap`), shiftId, requesterWorkerId,
    targetWorkerId (swap), `status` (`pending_peer\|pending_manager\|approved\|declined\|cancelled\|expired`),
    note, decidedBy, decidedAt, timestamps.
  - Partial unique index: one open request per (shift, requester, type).
- **`time_off_request`:** id, organizationId, workerId, startTime, endTime, allDay,
  reason, `status` (`pending\|approved\|declined\|cancelled`), decidedBy, decidedAt,
  managerNote, timestamps.

`worker_availability` (`unavailable`) stays as the worker's self-declared soft
availability.

**Worker-facing reads.** They must ignore `pendingState='add'`, keep showing
`'remove'`, and ignore `pendingPatch`. This applies to:
- `worker/all-shifts`
- shift detail
- clock-in eligibility in `packages/geofence`
- the notification scheduler

---

## 4. Backend (use cases → API)

**Domain (pure, unit-tested)** — `packages/scheduling-timekeeping/src/domain/`
- **`conflicts.ts`:** the single engine every entry point uses (create, edit, move,
  assign, copy, template, publish, claim, swap, approve).
  - Warnings: overlap (all three identity columns, org-scoped, excluding
    removed/cancelled) · approved time off · pending time off · unavailable ·
    weekly/daily overtime · role mismatch.
  - Returns `{type, severity:'block'|'warn', message}`.
  - Nothing blocks saving a draft. `block`-severity items need `force` (audited) at
    assign/publish.
- **`hours.ts`:** per-person week minutes minus unpaid break, counted across all org
  locations, in regular vs overtime. Uses `policy`: `weekly_40`, or `daily_8` via
  the existing `calculateDailyOvertimeMinutes` (`packages/config/src/time-rules.ts`).
- **`rates.ts`:** resolution order is `workerRole` (worker+org+role) →
  `member.hourlyRate` → `rosterEntry.hourlyRate` → none (flagged). Agency workers
  have no rate.
- **`labor-cost.ts`:** regular × rate + overtime × rate × 1.5, per day / person /
  week.
- Reuse: `utils/zoned-time.ts` (date-fns-tz), `utils/mapper.ts` (worker kinds),
  `canonicalizeWorkerRole` (`packages/database/src/worker-roles.ts`),
  `buildNotificationSchedule` (`packages/notifications`), `logAudit`, and the
  idempotency and rate-limit helpers used by `publish.ts`.

**Use cases** — `packages/scheduling-timekeeping/src/modules/scheduler/`

| Use case | Notes |
|---|---|
| `get-week` | View model: people, shifts, events, time off, availability, hours, cost, totals, pending-change counts, request counts |
| `create-shifts` | |
| `update-shift` | Stages into the working copy if published |
| `set-assignees` | |
| `move-assignment` | move/copy to a person/day; reuses a matching shift or creates one |
| `delete-shift` | |
| `copy-week` | Location tz, conflict-aware, never org-wide |
| `apply-template` | Wraps the existing templates module |
| `publish-week` + `preview-publish` | |
| `discard-week-changes` | |
| `events` | |

**Requests module** — `…/modules/requests/`: open shifts, claim, drop, swap,
time off, approve/decline. It enforces the org policies.

**Contracts** — `packages/contracts/src/scheduler.ts`: `SchedulerWeek`,
`SchedulerShift`, `SchedulerPerson`, `ConflictWarning`, `PublishPreview`,
`ScheduleEvent`, `ShiftRequest`, `TimeOffRequest`, and every request body.

**Routes** — `apps/api/src/routes/scheduler.ts` mounted at `/scheduler`, manager
role required, in the `createRoute` OpenAPI style of `routes/shifts.ts`:

| Method + path | Purpose |
|---|---|
| `GET /week?locationId&weekStart` | Week view model |
| `POST /shifts` | Create shift(s) |
| `PATCH /shifts/:id` | Edit |
| `DELETE /shifts/:id` | Delete |
| `PUT /shifts/:id/assignees` | Set assignees |
| `POST /assignments/move` | Move/copy an assignment |
| `POST /week/copy` | Copy a week |
| `POST /week/apply-template` | Apply a template |
| `GET /week/publish-preview` | Publish preview |
| `POST /week/publish` | Publish (idempotency key) |
| `POST /week/discard` | Discard unpublished changes |
| `POST /events` · `PATCH /events/:id` · `DELETE /events/:id` | Events |
| `GET /requests?status` · `POST /requests/:id/approve\|decline` | Requests (claim/drop/swap/time off) |

Worker endpoints go in `apps/api/src/routes/worker.ts`:

| Method + path | Purpose |
|---|---|
| `GET /worker/open-shifts` | Open slots for my roles |
| `POST /worker/open-shifts/:shiftId/claim` | Claim |
| `POST /worker/shifts/:id/drop` | Drop |
| `POST /worker/shifts/:id/swap` | Offer a swap |
| `GET /worker/requests` | My requests |
| `POST /worker/requests/:id/accept\|decline\|cancel` | Respond to or cancel a request |
| `GET/POST/DELETE /worker/time-off` | Time off |

Publishing and approvals queue pushes through the existing `scheduled_notifications`
pipeline.

---

## 5. Web frontend

**Stack:**
- Existing: Next 16 / React 19 / Tailwind 4 / shadcn (`packages/ui`) / SWR / zod.
- Grid: a custom CSS grid. No calendar library; resource timelines in those
  libraries are paid and person-row-hostile.
- **Add `@dnd-kit/core`** for pointer and keyboard drag. Check React 19
  compatibility at install; the fallback is `@dnd-kit/react`.
- The web client does no timezone math: the API returns location wall-clock fields.
- `apps/web/AGENTS.md` notes that this Next.js version has breaking changes; read
  `node_modules/next/dist/docs/` before coding.

**Data path:**
- `apps/web/lib/scheduler/client.ts` holds typed fetchers. They go through one
  catch-all proxy, `apps/web/app/api/scheduler/[...path]/route.ts`, that calls the
  existing `proxyApiRequest` (`lib/server/api-route-proxy.ts`) with
  `organizationScoped: true`.
- `use-scheduler-week.ts` uses SWR, with optimistic `mutate`, rollback, and
  server-returned warnings merged in.

**Files** — `apps/web/app/(protected)/schedule/`:

| File | Purpose |
|---|---|
| `page.tsx` | Server: session, locations, initial week |
| `_components/scheduler.tsx` | Client shell |
| `scheduler-toolbar.tsx` | Location select, week nav, grouping, tools, publish button |
| `week-stats-bar.tsx` | Open slots, hours, overtime, labor cost |
| `week-grid.tsx`, `person-row.tsx`, `role-row.tsx`, `open-row.tsx`, `event-lane.tsx`, `day-footer.tsx` | Grid |
| `shift-chip.tsx` | Chip states |
| `quick-create-popover.tsx` | Cell create |
| `shift-drawer.tsx` + `candidate-list.tsx` | Edit and staffing |
| `event-drawer.tsx` | Events |
| `publish-dialog.tsx` | Publish |
| `requests-panel.tsx` | Requests |
| `shortcuts-overlay.tsx` | Keyboard help |
| `hooks/use-grid-keyboard.ts`, `use-undo-stack.ts`, `use-scheduler-week.ts` | Behavior |
| `apps/web/lib/scheduler/parse-time-range.ts` (+ test), `role-color.ts` | Helpers; `role-color.ts` extends `lib/shifts/role-theme.ts` with a hash fallback |

**Touch-ups outside the Scheduler:**
- `components/nav-header.tsx`: nav becomes **Schedule** (with requests badge) ·
  Shifts · Roster · Reports. The "Create a schedule" CTA and the create-path check
  are removed.
- `lib/routes.ts`: add `getSchedulerHref`; remove the create path.
- Shifts page (`dashboard/shifts`): drop the Weekly layout toggle and the week-nav,
  copy-week and templates controls from `event-filters.tsx`. `draft-banner.tsx`
  links to `/schedule?week=`. The list and cards are otherwise unchanged.

**Delete** (after the Scheduler ships):

| Area | What goes |
|---|---|
| Web routes & components | `app/(protected)/dashboard/schedule/create/`, `components/schedule/*`, `lib/transformers/draft-to-form.ts`, `weekly-grid-view.tsx`, `lib/shifts/weekly-grid.ts` (+ test), `template-picker.tsx`, `draft-publish-bar.tsx` |
| Web actions & proxies | `_actions/copy-week.ts`, `_actions/publish-drafts.ts`, unused `app/api/worker/availability/route.ts` |
| API routes | `DELETE /shifts/drafts`, `POST /shifts/publish`, `/shifts/copy-week`, `/shifts/publish-drafts`, `GET /shifts/groups/:id`, `GET /shifts/open` |
| Services | The services behind those routes, once nothing else calls them |

## 6. Mobile (`apps/gig-workers`)

| File | Change |
|---|---|
| `app/(tabs)/_layout.tsx` | Add the Open and Requests tabs |
| `app/(tabs)/open.tsx` | New |
| `app/(tabs)/requests.tsx` | New |
| `app/time-off/new.tsx` | New |
| `app/shift/[id]/swap.tsx` | New |
| `app/shift/[id]/index.tsx` | Drop/Swap actions |
| `lib/api.ts` | New worker methods |

Follow the existing `Screen` / `PageHeader` / `EmptyState` / heroui-native patterns.

---

## 7. Build order (each milestone ships green)

| Milestone | Work |
|---|---|
| **M0 — Design sign-off** | Clickable HTML prototype of the Scheduler (week grid, quick-create, drawer, publish dialog, requests panel, event lane) with realistic data; owner approves before code. |
| **M1 — Foundations** | Migration · contracts · domain (`conflicts`, `hours`, `rates`, `labor-cost`) with unit tests · `get-week` + `GET /scheduler/week`. |
| **M2 — Read-only grid** | `/schedule` page, People/Roles grouping, week nav, location tz, hours/overtime/cost, time off, availability, nav change. |
| **M3 — Editing** | Quick-create, drawer + candidates, drag move/copy, Open row, delete, undo, keyboard, copy week, templates, discard. |
| **M4 — Publish** | Working copy, preview + publish, batched notifications, audit, worker reads honor staging. |
| **M5 — Events** | Event drawer, lane, rollup, Roles view polish. |
| **M6 — Requests** | Worker endpoints, mobile Open/Requests/Drop/Swap/Time off, manager Requests panel + nav badge, pushes, org policy settings in Settings. |
| **M7 — Remove old** | Delete the create flow, weekly grid and old endpoints; migrate the e2e tests. |

Later, not in Phase 1: day timeline with hourly headcount strip, auto-assign, sales
forecast/labor %, recurring availability, compliance rules (minors, rest periods,
predictability pay), cross-location view.

## Out of scope, found during the audit (fix separately; on kept pages)
- **Timesheet Approve does nothing.** `timesheet/client.tsx` never passes
  `onApprove` to `ShiftDetailView`, and no server action wraps `approveShift`.
- **Adding a worker with an overlapping shift reports success.** In
  `_actions/timesheet.ts`, `assignWorkersToShiftAction` only handles
  `capacityConflict`. The overlap warning falls through to `{success:true}`, and the
  detail view adds the workers locally even though the server wrote nothing.
- **No manager-role gate in the web app.** `isManagerOrganizationRole` is never
  used, so a worker session sees empty dashboards instead of a redirect.

## 8. Verification
- **Unit (`bun run test`):**
  - Conflicts: overlap edges, overnight shifts, cross-location, time off vs
    unavailable.
  - Hours: `weekly_40` / `daily_8`, breaks, a week spanning two policies.
  - Rates: fallback chain. Labor cost.
  - `get-week`: timezone boundaries (DST week).
  - Working-copy publish diff.
  - Request state machines.
  - `parse-time-range`.
- **API route tests:** mocked services, following `apps/api/src/routes/shifts.test.ts`,
  for every `/scheduler` and new `/worker` route: role gating and `x-org-id`
  mismatch.
- **Checks:** `bun run check-types`, `bun run lint`, drizzle `db:generate` producing a
  clean migration.
- **E2E (Playwright):**
  - New `tests/e2e/tests/web/scheduler.spec.ts`: type `9-5` into a cell → draft
    chip; drag to another person; Alt-drag copy; undo; the publish dialog lists
    counts; the chip turns solid.
  - New `tests/e2e/tests/api/scheduler.spec.ts`: claim → approve → assigned;
    approved time off → conflict flagged; publish notifies only changed people.
  - Rewrite `tests/web/web.spec.ts` "can create new shift" and
    `tests/api/lifecycle.spec.ts` against the new endpoints.
- **Manual:**
  - `bun run dev` plus the `tests/e2e` seed; walk the Scheduler at 1280px and
    1024px and capture screenshots.
  - Expo simulator: claim an open shift, drop, swap between two seeded workers,
    request time off, then approve each from the web Requests panel.
