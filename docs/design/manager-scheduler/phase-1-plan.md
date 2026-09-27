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
headcount-per-role are first-class, conflicts and scheduled hours are visible inline, and
workers can claim, drop, swap and request time off from their phones.

## Decisions (confirmed with owner)
- **Keep untouched:** Shifts *list* view (cards, banners, summary) and the shift
  detail/timesheet page (`dashboard/shifts/[shiftId]/timesheet`).
- **Replace:** Weekly day-rows view, `/dashboard/schedule/create`, and schedule
  building/assigning → one new **Scheduler** at `/schedule`.
- **Depth:** new UI + reshaped scheduling API/contracts; DB changed only where the
  design needs it (additive migration).
- **Phase 1 scope:** build/publish week · scheduled hours & overtime per person ·
  open shifts claimable on mobile · time-off & swap requests with manager approval.
- **Hours, not pay (revision 2).** The product is timesheet-focused. Pay and labor
  cost belong to HR/payroll.
  - The scheduler shows **no dollar amounts**: no labor cost and no rate warnings.
  - A worker's hourly rate stays an optional, suggested field in the Roster
    (`member.hourlyRate` / `rosterEntry.hourlyRate` / `workerRole.hourlyRate`
    already exist). It is not used in scheduling.
  - Exports stay hours-only, matching the existing payroll CSV.
- **Setup model: presets, not SAP-style configuration (revision 3).** The owner
  asked whether businesses should configure the system at onboarding.
  - **Answer:** ask 3 plain questions during onboarding. The answers pick sensible
    defaults, and everything can be changed later in Settings → Scheduling.
  - **Why not SAP-style:** that model depends on implementation consultants, and
    small business owners can't answer abstract setup questions before using the
    product. It also multiplies test cases.
  - **No rule builders, custom workflows or custom fields in Phase 1.**
  - The existing onboarding already follows this pattern: its on-site attendance
    toggle in `business-basics-step.tsx`.
  - **Where each choice lives:**

    | Where | Who | What |
    |---|---|---|
    | Onboarding | Owner, once | Business type · how the schedule changes week to week · open-shift claim approval |
    | Settings → Scheduling | Admin, rarely | Week start day · overtime rule (existing `regional_overtime_policy`) · claim/swap approval · departments |
    | Inside the Scheduler | Each manager, remembered | Department filter · view by People or Positions · compact rows |

- **Scale (revision 3).** The design must hold at 50+ workers; see §2.1a.
- **Simplicity (revision 2).** Owner feedback on prototype v1: too cluttered and
  confusing (the extra rows above the team, numbers everywhere, too many controls).
  §2 is rewritten around the "clean grid" layout the owner chose.
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
8. **Hours are never computed for scheduling.** Only reporting reads the overtime
   policy. Pay rates exist but never reach a shift, which is fine: the Scheduler
   stays hours-only by decision.
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

### 2.1 Layout: the clean grid (desktop ≥1024px; `/schedule?location=&week=`)
The owner picked this layout after prototype v1.
```
Downtown Bistro ▾   ‹ Sep 27 – Oct 3 ›           6 open · 4 requests   ⋯   [Publish 6]
─────────────────────────────────────────────────────────────────────────────────────
 🔍 Find person   Sun 27   Mon 28   Tue 29   Wed 30   Thu 1    Fri 2    Sat 3
                                                                        ◆ Smith Wedding 5/8
 Open             ·        2 Server ·        1 Cook   ·        ·        3 open
─────────────────────────────────────────────────────────────────────────────────────
 Ana Ruiz         9a–3p    4p–11p   ·        11a–7p   4p–11p   4p–11p   ◆4p–11p     39.5h
 Ben Kim          4p–11p   11a–7p   Off  !   4p–11p   11a–7p   11a–7p   ·           41.5h OT
 Priya Shah       9a–3p    ·        4p–11p   11a–5p   ·        Off? !   ◆4p–11p     31h
 Marcus Lee  inv  ·        ·        ·        ·        ╱11a–5p╱ ·        11a–5p      12h
 ▾ Front of house · 22 people · 3 open        (collapsible department section)
 Cara Diaz        11a–5p   ·        5p–12a   5p–12a   ·        6p–2a    ◆4p–11p     33h
```
**What's on screen, and nothing more:**
- **Toolbar, one row:**
  - Location, and the week with ‹ › arrows. "This week" appears only when you're
    viewing another week.
  - Department chips (`All · Front of house · Kitchen`), shown once the org has
    more than one department (§2.1a).
  - Two clickable counters: **open slots** (scrolls to and highlights the Open row)
    and **requests** (opens the Requests panel).
  - **⋯** (copy last week, apply template, add event, discard changes, help).
  - **Publish N**.
- **Removed from v1:**
  - Stats bar, dollar amounts, day totals, legend row.
  - Filters row: search moves into the name-column header.
  - People/Roles toggle in the toolbar (the Positions view moves into ⋯ → View
    by), Events lane, role group headers (replaced by department sections).
  - Prototype hint strip: the help text moves into ⋯ → Help.
- **Rows:**
  - One **Open** row on top, then people.
  - People sit in collapsible department sections (§2.1a), sorted by main role,
    then name.
  - The name cell shows name + main role. An "Invited" or "Agency" tag appears
    only when it applies.
- **Events** are a small tag in the day header ("◆ Smith Wedding 5/8", colored by
  how staffed it is). Clicking it opens the event panel. Event shifts show a ◆ on
  their chip.
- **Chips are one line:** the time only. The role is added only when it differs
  from the person's main role ("11a–5p · Server").
- **Chip markings** (the owner kept these):
  - Stripes = not published yet.
  - Amber dot = published shift with unpublished edits.
  - Red **!** = something blocking (double-booked, approved time off).
  - Softer warnings (unavailable, overtime, not trained) show only on hover and in
    the shift panel. They get no badge, which keeps the grid quiet.
- **Row end:** scheduled hours only. Amber within 4h of overtime; red over it, with
  "OT". No cost.
- **Time off:** a compact "Off" cell ("Off?" while pending; hover shows exact
  times). Unavailable windows are a faint hatch, with details on hover.
- **Empty week:** one line, "Nothing scheduled yet · Copy last week · Use a
  template". It never blocks navigation.
- **Pinned while scrolling:** day headers and the name column.
  - The week always starts on the org's `weekStartsOn`. All times are in the
    location's timezone.
  - Note from the v1 prototype: pinning to the *bottom* does not work for CSS grid
    cells, so nothing depends on a pinned footer.

### 2.1a Holding up at 50+ workers
Fifty people in comfortable rows is about 3,000px of scrolling. That's usable once,
but not every week. What fixes it:
1. **Department filter** in the toolbar: `All · Front of house · Kitchen`.
   - At this size each manager usually schedules one department, so the view drops
     to 12–25 rows.
   - The choice is remembered per manager.
   - Departments are groups of roles (Kitchen = Line cook, Prep, Dishwasher). A
     person shows up in a department through their roles, so nobody has to assign
     people to departments by hand.
   - Departments come pre-filled from the business type chosen at onboarding.
2. **Collapsible department sections** replace the v1 role group headers. Each
   header shows the department name, headcount, and open slots.
   - Collapsed: one line with hours and open count.
   - Expanded: its people.
3. **Compact rows by default** (≈40px, one-line chips).
   - A person with two shifts in a day shows "2 shifts" until hovered or expanded,
     so the row height stays even.
4. **Search** in the name column (already in §2.1). Row virtualization kicks in
   above ~150 people; that's a build detail and invisible to users.
5. **View by Positions** (rows = roles, each shift showing `filled/needed`), picked
   from ⋯ → View by.
   - It is the default for businesses that answered "changes around events" at
     onboarding.
   - Staffing 8 servers for a wedding is faster by position than by scanning 50
     names.
   - This brings back v1's Roles view without the extra toggle in the toolbar.

### 2.1b Onboarding: "How you schedule" step
A new step, `scheduling-setup-step.tsx`, goes after "Location basics" in
`app/(protected)/dashboard/onboarding/_components/`. It is wired through
`business-onboarding-view.tsx`. Three questions, each a tappable choice, with one
line explaining what it changes:

1. **What kind of business is this?**
   - Choices: Restaurant or bar · Retail store · Events & catering · Something else.
   - Seeds the starter roles and departments:
     - Restaurant: Front of house (Server, Host, Bartender, Busser) · Kitchen (Line
       cook, Prep, Dishwasher).
     - Retail: Sales floor (Cashier, Sales associate) · Stock (Stock associate) ·
       Leads (Shift lead).
     - Events: Service (Server, Bartender) · Kitchen (Cook, Prep) · Setup (Setup
       crew).
     - Other: one "Team" department.
   - The seeds are editable.
2. **How does your schedule change week to week?**
   - Choices: Mostly the same every week · It changes around events and bookings.
   - "Mostly the same": the Scheduler defaults to the People view, and an empty week
     offers "Copy last week" first.
   - "Around events": the Scheduler defaults to the Positions view, and "Add event"
     sits in the toolbar instead of the ⋯ menu.
3. **When someone picks up an open shift…**
   - Choices: I approve it first · First to claim gets it.
   - Sets `openShiftClaimPolicy`.

"Skip for now" applies the Restaurant defaults. Settings → Scheduling (a new tab in
the existing `settings/[[...tab]]` page) shows the same three answers, plus week
start, overtime rule, swap approval and a department editor.

### 2.2 Interactions
| Action | Behavior |
|---|---|
| Create | Click an empty cell (or Enter on a focused cell) → **quick-create popover**. |
| Quick-create fields | Just the **time** field and **role** (defaults to the row's role). Time accepts `9-5`, `9a-5:30p`, `17-23`, `10-2` (overnight aware). Break is auto-set (30 min over 6h) and editable in the shift panel. Enter saves as a draft. |
| Edit | Click a chip → right **Shift panel** (Sheet). Fields: time, day, role, break, how many people, note to staff. Manager note and event sit under "More". **On this shift** list, then **Who can take it**. Actions: duplicate, save as template, delete/remove, "Open timesheet" (links to the kept detail page). |
| Candidates | Ranked qualified-first: role match, no conflict, fewest hours this week. No pay shown. Each row shows why it isn't recommended ("On time off 2–6p", "Would be at 44h"). Choosing a flagged person asks **"Schedule anyway"**, which is audited. |
| Move | Drag a chip to another cell, person or day. The shift keeps all its details. |
| Copy | **Alt/Option-drag**, or `c` / `v` on a focused chip. |
| Unassign / assign | Drag to the Open row = unassign (the slot stays open). Drag from Open onto a person = assign. |
| Keyboard | Arrow keys move focus · Enter opens · `c` / `v` / `Delete` · `z` undo / `Shift+z` redo · `n` new open shift · `?` shortcut overlay. |
| Undo | Every grid operation has an inverse. An "Undone / Redo" toast plus an undo stack for the session. |
| Headcount | Capacity is a number field ("How many"). Open slots render as one chip reading "3× Server". |
| Events | ⋯ → "Add event", or click a day header's event tag. **Event panel:** name, day, time, notes, and roles needed (role × how many). This creates the event plus one shift per role, with open slots in the Open row. The panel lists each role's fill with a "Staff" button that opens the shift panel. |
| ⋯ menu | Copy last week (keep people / as open shifts) · Apply template · Add event · Discard unpublished changes (this week and location only) · Help & shortcuts. |
| Publish | The button shows the pending count and is grey when there is nothing to publish. The dialog shows: new / changed / removed shifts; the named people who will be notified (one batched push each, **only people with changes**); the named invited/agency people who can't be reached ("tell them yourself"); open slots that become claimable; and unresolved conflicts, with "Review" jumping to each one. Scope is **this location + this week**. |
| Requests | The "N requests" counter (and a badge on the "Schedule" nav item) opens a right panel. It is one list, newest first, with a type label on each card (Time off · Swap · Drop · Claim); no tabs. Each card shows the exact times and the impact ("Opens 1 Server slot Tue", "Ben would be at 44h"). Approve / Decline with a note. |

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

### 2.3b Prototype v2: changes from v1 (next step after this plan is approved)
Edit `scratchpad/scheduler-prototype.html`, republish to the same artifact URL, and
update `docs/design/manager-scheduler/prototype.html` + this plan copy on the branch.
- **Remove:**
  - Prototype hint strip (the text moves into ⋯ → Help).
  - The "Schedule" h1 (keep it for screen readers only).
  - Stats bar, filters row + legend, People/Roles toggle, Tools button, Events
    lane, role group header rows.
  - Every `$`: row cost, candidate cost, stats, day totals in headers.
- **Toolbar:** location · week ‹ › · ("This week" only off the current week) ·
  "N open" and "N requests" counters · ⋯ · Publish N.
- **Grid:**
  - Search box in the name-column header.
  - Day header shows the day and date, plus an event tag when there is one.
  - Open row, then people in collapsible department sections.
  - One-line chips, with the role only when it differs from the person's main role.
  - Red ! only for blocking conflicts; other warnings on hover.
  - "Off" / "Off?" cells.
  - Row end shows hours only, with OT in red.
- **Panels:**
  - Quick-create is only time + role.
  - The shift panel moves manager note and event under "More" and drops pay.
  - Requests become one list without tabs.
  - The help dialog adds a short "what the markings mean" section.
- **Scale:**
  - Grow Downtown Bistro's sample team to ~48 people across Front of house and
    Kitchen.
  - Add department chips, collapsible department sections, compact rows, and
    ⋯ → View by People / Positions.
- **Setup:**
  - A clickable mock of the 3-question "How you schedule" onboarding step, opened
    from ⋯ → "Setup questions".
  - Changing an answer visibly switches the defaults (view, departments, claim
    policy).
- **Keep as is:** drag/Alt-drag, undo, typed times, candidates with reasons, the
  publish dialog, the event panel, retail sample data.

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
| `organization` | Add `weekStartsOn` smallint default 0 · `openShiftClaimPolicy` text `'approval'\|'auto'` default `'approval'` · `swapApprovalRequired` boolean default true · `businessType` text `'restaurant'\|'retail'\|'events'\|'other'` · `scheduleStyle` text `'steady'\|'events'` (picks the default view) |
| `shift` | Add `breakMinutes` int default 0 · `eventId` → `schedule_event` (nullable, set null on delete) · `pendingPatch` jsonb null · `managerNote` text · `publishedAt` timestamptz. Keep `description` as the staff note. Stop overloading `scheduleGroupId` (legacy only). |
| `shift_assignment` | Add `pendingState` text null (`'add'\|'remove'`). Rate columns stay untouched and unused by scheduling. |

**New tables**
- **`department`:** id, organizationId, name, `roles` jsonb string[] (canonicalized
  with `canonicalizeWorkerRole`), sortOrder.
  - Seeded from the business-type preset.
  - Membership is derived from a person's roles, so there is no join table.
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
- No rate or labor-cost modules: scheduling is hours-only (see Decisions).
- Reuse: `utils/zoned-time.ts` (date-fns-tz), `utils/mapper.ts` (worker kinds),
  `canonicalizeWorkerRole` (`packages/database/src/worker-roles.ts`),
  `buildNotificationSchedule` (`packages/notifications`), `logAudit`, and the
  idempotency and rate-limit helpers used by `publish.ts`.

**Use cases** — `packages/scheduling-timekeeping/src/modules/scheduler/`

| Use case | Notes |
|---|---|
| `get-week` | View model: people, shifts, events, time off, availability, scheduled hours + overtime per person, open-slot count, pending-change count, request count |
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

**Setup presets** — `packages/organizations`:
- `presets.ts`: roles and departments per business type (pure data).
- `apply-scheduling-setup.ts`: saves the 3 answers, seeds departments and roles
  once, and never overwrites edits.
- `departments.ts` (CRUD).
- Routes:
  - `POST /organizations/onboarding/scheduling`
  - `GET/PATCH /organizations/scheduling-settings`
  - `GET/POST/PATCH/DELETE /organizations/departments`
- Onboarding completion state in the existing onboarding module learns about the
  new step.

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
| `scheduler-toolbar.tsx` | Location, week nav, open/requests counters, ⋯ menu, Publish |
| `week-grid.tsx`, `day-header.tsx` (with event tag), `open-row.tsx`, `person-row.tsx` | Grid |
| `shift-chip.tsx` | One-line chip: time, stripes/dot/! markings |
| `quick-create-popover.tsx` | Cell create |
| `shift-drawer.tsx` + `candidate-list.tsx` | Edit and staffing |
| `event-drawer.tsx` | Events |
| `publish-dialog.tsx` | Publish |
| `requests-panel.tsx` | Requests |
| `help-dialog.tsx` | How to use + keyboard shortcuts + what the markings mean |
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
| **M0 — Design sign-off** | v1 prototype published and reviewed. **Next: prototype v2** with the clean grid (§2.1), the same URL republished (https://claude.ai/artifact/FYrErrVCSuL2deWSRpB4K3), and the repo copy in `docs/design/manager-scheduler/` updated. Owner approves v2 before code. |
| **M1 — Foundations** | Migration · contracts · domain (`conflicts`, `hours`) with unit tests · `get-week` + `GET /scheduler/week`. |
| **M1b — Setup presets** | Business-type presets, departments, onboarding "How you schedule" step, Settings → Scheduling tab. Existing orgs get Restaurant defaults. |
| **M2 — Read-only grid** | `/schedule` page, clean-grid layout, department chips + collapsible sections, compact rows, People/Positions view (default from `scheduleStyle`), week nav, location tz, scheduled hours/overtime, time off, availability, nav change. Checked with a 60-person seed. |
| **M3 — Editing** | Quick-create, drawer + candidates, drag move/copy, Open row, delete, undo, keyboard, copy week, templates, discard. |
| **M4 — Publish** | Working copy, preview + publish, batched notifications, audit, worker reads honor staging. |
| **M5 — Events** | Event panel, day-header event tag with fill status, ◆ on event chips. |
| **M6 — Requests** | Worker endpoints, mobile Open/Requests/Drop/Swap/Time off, manager Requests panel + nav badge, pushes, org policy settings in Settings. |
| **M7 — Remove old** | Delete the create flow, weekly grid and old endpoints; migrate the e2e tests. |

Later, not in Phase 1: day timeline with hourly headcount strip, auto-assign, recurring
availability, compliance rules (minors, rest periods, predictability pay),
cross-location view. Labor cost is not planned; pay stays with HR/payroll.

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
  - Presets: each business type seeds the right roles and departments, and
    re-running setup never overwrites edits. Department membership is derived
    from roles.
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
