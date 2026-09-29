# Manager Scheduling — Phase 3: Touch-first redesign

Changes two earlier decisions: the grid is no longer desktop-only ([`phase-1-plan.md`](./phase-1-plan.md)),
and phone triage is replaced by a real Day / Week / Month on phones
([`phase-2-manager-landing.md`](./phase-2-manager-landing.md), §3 and §4 are superseded by this document).

**Clickable prototype:** [`prototype-v2.html`](./prototype-v2.html). Open it in a browser and use the
Desktop / Phone switch at the top. It uses sample data and saves nothing.

## Context

Drag and drop does not work on a phone, and the scheduler is the product. The design below treats
the business side as a fresh design and makes touch the first-class input. Workers are mobile-only and
are a separate universe; they are designed after this (§13).

**Why touch fails today** (verified in the code):

- One sensor is registered: `PointerSensor` at `apps/web/app/(protected)/schedule/_components/scheduler.tsx:160`,
  inside a `DndContext` at `scheduler.tsx:319`. There is no `TouchSensor`. `touch-action` appears nowhere in
  the scheduler files, so a touch starts a scroll and the drag never begins.
- Seven actions have no non-drag route (§6): hand a shift to another person, move one person of a group
  shift, make my spot open, copy to a specific person and day, and move an open spot. Copy is otherwise
  keyboard-only (`c`, `v`).
- The grid is fixed at `min-width: 1040px` (`scheduler.module.css:6`), chips are 24px tall, and the `+N more`
  in a cell is plain text (`week-grid.tsx:16`, `:256`).
- There is no day view, no month view, and the API returns one week (`get-week.ts`). The web app has no PWA
  manifest, no safe-area handling and no `dvh` sizing.

**Decisions**

| Decision | Choice |
|---|---|
| Starting point | As if no design existed. The product was never live, so there are no compatibility limits. |
| Scope now | Business side first. Worker read receipts and teammates-on-shift are deferred. |
| Managers on phones | Touch-first everywhere. The phone gets day-centric layouts and full editing. |
| Drag | An optional desktop accelerator. Nothing depends on it. |

## 1. Try the prototype

| Try this | What it shows |
|---|---|
| Desktop: click a shift, then **Move**. | The grid dims and every cell gets ✓ / ⚠ / ✕. Hover a cell for the reason. |
| Desktop: click a shift, then **Copy**, then **Weekdays**, then **Done**. | Copy to many days in one action. Days that would be blocked are skipped and counted. |
| Click an empty cell, then a **usual shift** chip. | Creating a shift in two taps. Type `4-11` to see the live parse. |
| Click an open slot in the Open row. | The inspector has *How many people*, *Who can take it* and **Offer** to matching workers. |
| **Month**, then the *Time off*, *Events* and *Drafts* lenses, then **Table**. | One question at a time, and the table twin of the heatmap. |
| Click a bar in the strip at the top. | Jump three weeks ahead without opening a month page. |
| Phone: **Week**, **People**, then tap a person. | A phone-sized way to schedule by person, with no grid. |
| Phone: tap a shift, then **Move** or **Copy**. | Day chips instead of dragging. |
| Inbox, then **Approve** on Cara's time off, then back to Schedule. | A decision with a consequence: it creates a conflict, and the week says so. |
| Press `1` `2` `3`, `m` `c` `g` `o`, `z`, `Esc`. | The keyboard covers the same actions. |

## 2. Principles

Each principle rules something out.

1. **Every action has a tap path.** Drag is a shortcut, never a requirement (WCAG 2.2 SC 2.5.7, Dragging Movements).
2. **One canvas, three zooms.** Day, Week and Month share one date and one set of filters, so zooming never loses your place.
3. **Coverage before people.** The first question is "am I covered?", not "what is Ana doing?".
4. **One question at a time.** A lens shows one thing: coverage, time off, events or drafts. Never all of them.
5. **A clutter budget.** Three marks on a shift, one number per day, six controls in the toolbar.
6. **Same content, two containers.** The inspector is a right panel on desktop and a bottom sheet on a phone.
7. **Everything is undoable.**

## 3. Information architecture

**Schedule · People · Inbox · Time.** Settings sit under the avatar.

- There is no separate Shifts list. Upcoming lives in Schedule. Past shifts and timesheet approval live in Time.
  This removes the "two places to see shifts" confusion.
- **Inbox** is the one place for everything waiting on the manager: claims, drops, swaps, time off and timesheets.
  It carries one badge.
- Phone: bottom tabs **Schedule · Inbox · People · Time**.

## 4. The Horizon strip

A coverage minimap of the next six weeks, always visible above the grid. It is the reason a manager sees a hole
three weeks out without opening anything, and it replaces the phase-2 "needs you" strip.

| Encoding | Meaning |
|---|---|
| Bar height | Filled slots ÷ all slots that day |
| Green | Every slot filled |
| Amber | Some open: at least 80% filled |
| Orange | Short: under 80% filled |
| Outlined bar (not solid) | Has drafts. Workers can't see it yet |
| Flat line | Nothing scheduled |
| ◆ | An event that day |
| Red dot | Today |
| Grey box around a week | The week you are viewing |

- Form carries the meaning, not just hue: height for magnitude, solid vs outlined for published vs draft. Colors are the
  fixed status palette and always pair with a label (tooltip, aria-label, the Month table, the legend).
- Desktop: every bar is a link to that day. Phone: each *week* is one 44px tap target, because a bar is about 6px wide.
  Tapping a week keeps the weekday you were on.
- Legend: the **Key** button on desktop, and **More → How to read the strip** on phone.
- Hover and focus show a tooltip (`Thu Oct 8 · 7 of 9 filled · 2 open · Draft`). Tapping is never gated on it.

## 5. Three zooms

| Zoom | Desktop (≥1024px) | Phone |
|---|---|---|
| **Day** | Hour timeline with a lane per role. A coverage ribbon sits on top, aligned to the hours. Bars are shifts, dashed bars are open slots. | Headline (`10 on shift · 2 open`), the coverage ribbon, then dayparts (Morning, Midday, Evening, Late), each `5 of 7` with a meter. Open slots sit under people with **Assign** and **Offer**. |
| **Week** | People × days grid, or **By role** (`4p–11p 3/4` per cell). Each day header has a coverage bar, an open count and an event line. | Seven day rows with a coverage bar. **People** lens: a row per person with seven day dots and hours. Tapping a person opens their week in a sheet. |
| **Month** | Heatmap: date, coverage meter, `N open`. A gutter per week says *Live*, *N drafts* or *Not started*. | The same, sized for a thumb. |

**Month lenses.** Coverage, Time off, Events, Drafts. One at a time, with a legend. **Table** shows the same data as rows.
Tapping a day opens a peek (desktop: the inspector; phone: a sheet) with **Open day** and **Open week**.

**Day-part names** come from shift start times: before 11:00 Morning, 11:00–14:59 Midday, 15:00–21:59 Evening, 22:00 on Late.
Presets can rename them per business type.

**Landing.** Phone opens Day if today has shifts, else Week. Desktop opens Week using the time-aware rule from phase 2
(this week, or next week when this week is clean and next is empty or has drafts), with a visible "Showing next week · Back" chip.
The prototype does not implement that chip.

## 6. Editing without drag: select → act → place

- **Add.** Tap an empty cell. A sheet offers **usual shifts** (learned from templates and history) and a typed time.
  `9-5`, `4p-11p`, `17-23` and `10p-2a` all parse, and the result shows live (`4p–11p · 6.5h paid`, or `ends next day`).
- **Select.** Tap a shift. An action bar appears: **Move · Copy · Give to… · Make open · Delete**. For an open slot:
  **Move · Copy · Assign to… · Offer · Delete**. The inspector shows the details.
- **Place mode** (Move, Copy on desktop). A banner says what you are placing. Every target cell gets ✓ fits, ⚠ works with a
  warning, or ✕ blocked. Blocked targets ask "Schedule anyway?" and are recorded.
- **Copy to days.** Chips for Mon–Sun and **Weekdays**, several targets, then **Done · N copies**.
  Days that would be blocked are skipped, and the toast says how many.
- **On a phone** Move and Copy are a sheet of seven day chips with the same ✓ / ⚠ / ✕. Changing *who* works it is a
  separate **Give to…**, so a phone move is day-centric.
- **Give to… / Assign to…** ranks people: qualified first, no conflict, then fewest hours. Each row says why it isn't a fit.
- **Offer** pushes an open slot to matching workers, who claim it from their phones.
- **Multi-select.** More → *Select shifts*, or long-press a shift. Then **Copy to days** or **Delete** in bulk.
- **Undo** after every change, in a toast and on `z`.
- **Drag** stays as an optional accelerator (`TouchSensor` with a press delay, `touch-action` on the chip). Nothing relies on it.

**Every drag-only action from the code review has a tap path:**

| Drag-only today | Tap path |
|---|---|
| Person → another person, same day | Select → **Give to…** |
| Person → another person and day | Select → **Move** → tap the cell |
| One person of a group shift → another day | Select → **Move** (moves only that person) |
| Open chip → a person | Select the open slot → **Assign to…** |
| Person → the Open row | Select → **Make open** |
| Copy to a specific person and day | Select → **Copy** → tap cells or day chips |
| Open spot → another day | Select the open slot → **Move** |

**Reuse unchanged:** `planMove` (`apps/web/lib/scheduler/plans.ts:99`), `planRemove` (`plans.ts:182`), `checkPerson`
(`lib/scheduler/candidates.ts:23`), `rankCandidates` (`candidates.ts:76`) and `use-scheduler-edits.ts` for batching, undo and
the conflict prompt. Only the input layer changes.

**Keyboard.** `1 2 3` zoom · `m c g o` move, copy, give, make open · `Delete` · `z` undo · `Esc` cancel.

## 7. The inspector

- Nothing selected: what needs the manager in the viewed span, as a list. Problems, open slots, unpublished changes and
  requests. Each item focuses the grid. This replaces the toolbar counters.
- A shift selected: time, day, role, *How many people* (open slots), a callout for each mark, and *Who can take it*.
  Editing the time uses the same shorthand as adding.
- A day selected (header or month cell): coverage, dayparts, **Open day**, **Open week**.
- Desktop: right panel. Phone: a bottom sheet from the action bar's **Details** or a second tap on the selected shift.

## 8. The clutter budget

- **Three marks on a shift:** *Unpublished* (stripes, merging today's "draft" and "edited"), *Open* (dashed) and *Problem*
  (a red **!** with text in the inspector). Time off is an "Off" cell. Unavailable, overtime and "not trained" appear only in the
  inspector and the ranking.
- **Chips** show the time only, plus the role when it differs from the row's main role. Open slots stack role over time
  because a 112px column cannot fit both on one line. Two chips per cell, then a tappable `+N`.
- **Numbers only when actionable.** The open count shows above zero. Hours turn amber near 40 and red over, with "OT".
- **Toolbar:** Day/Week/Month, date, Today, By person/By role, *Needs attention only*, undo, more, **Publish N**.
  Publish is the only primary action.
- **Place-mode hints are glyphs only.** The reason is in a tooltip and in the "Schedule anyway?" step. People who lack the role
  are dimmed. Without this, 76 of about 120 cells showed an amber outline and a sentence.
- **A draft week gets one note.** When 85% or more of a span is unpublished, one banner says so and the chips lose their stripes.
  Otherwise a new week is a wall of hatching.
- **Role colors** are categorical slots 1–5 in order (blue, orange, aqua, yellow, magenta), used as a 3px rail and a light tint.
  They pass the adjacent-pair color-blind check in both themes. Three light-mode hues are under 3:1 against the surface,
  so a role name is always shown as text as well.
- **Brand red** is for the primary action and today's date. Problem is a different red with an icon and text, and never color alone.

## 9. States

| State | What the manager sees |
|---|---|
| Healthy | No mark noise. Publish is grey. The inspector says "All clear". |
| Empty week | *Nothing scheduled for Oct 18 – 24* with **Build from usual shifts** and **Copy last week**. Both are undoable. |
| Empty day | *No shifts on Saturday* with **Add open shift**. |
| Draft week | One note, dashed chips (§8). |
| Blocked target | "Schedule anyway?" with the reason. Cancel leaves everything as it was. |
| Loading | The grid comes from the server render. The strip and Month stream in after first paint. |
| Strip data fails | The strip is hidden. The grid is unaffected. |
| No location, no team | The existing notices, each with a button. |
| Multi-location | A dot on the location select when another location needs attention. |

## 10. Accessibility

- WCAG 2.2 **2.5.7**: every drag has a tap or keyboard path.
- **Touch targets.** On a 390px-wide phone every control is at least 44px, audited by script across Day, Week (Days and People),
  Month, the Month table, Inbox, People and the shift-details sheet. Stated plainly, the exceptions are:
  the strip's 6px bars are display only (the week is the 44px target); the Month week gutter is 36px wide and reaches 44px through
  a hit area that extends into the page margin; and on a 360px phone the Month day cells are about 41px wide (44px tall).
  All clear the WCAG 2.5.8 minimum of 24px.
- Color is never alone: marks have shapes and text, coverage has height and outline, the strip has a legend, tooltips, aria-labels and the Month table.
- Role colors: worst adjacent color-blind separation ΔE 9.1 (light) and 8.4 (dark), normal-vision floor 19.6 and 19.3.
- Every shift and every day has an aria-label that states person, time, role and marks. Toasts use `role="status"`.
- Reduced motion turns off the sheet and toast animation. Forced-colors keeps dashed outlines.

## 11. Data and platform

**Exists**

- `SchedulerWeek` (`packages/contracts/src/scheduler.ts:154`): people, shifts, events, time off, unavailable, and `summary`.
  Day and Week views derive everything per day from it. No new API for those.
- The requests and approval routes under `/scheduler`, and the ranking in `lib/scheduler/candidates.ts`.

**New**

- **`GET /scheduler/coverage?locationId&from&to`** returns per day `{ capacity, filled, open, draftCount, eventCount, timeOffCount }`.
  Aggregate SQL, not full weeks. It feeds the Horizon strip, Month and the landing rule. Layering per
  `docs/architecture/api-first-backend-blueprint.md`: contract in `packages/contracts/src/scheduler.ts`, use case in
  `packages/scheduling-timekeeping/src/modules/scheduler/`, thin route in `apps/api/src/routes/scheduler.ts`, SWR client in
  `apps/web/lib/scheduler/client.ts`.
- **Limit, said plainly:** "capacity" means slots to fill, not forecast demand. There is no minimum-staffing rule model yet,
  so *covered* means filled ÷ capacity.

**Web platform work**

- PWA manifest (installable to the home screen), `viewport-fit=cover`, safe-area insets, `dvh` instead of `vh`, and
  `@media (pointer: coarse)` for 44px targets.
- Bottom sheets from the existing `@repo/ui` `drawer`.
- `apps/web/AGENTS.md` warns that this Next.js has breaking changes. Read `node_modules/next/dist/docs/` before building.

## 12. What building the prototype taught us

These changed the design. They are the reason to test a design before building it.

1. **Place mode was unreadable.** Role mismatch counts as a warning, so most cells lit up amber with a sentence each.
   Now: glyphs only, reasons on hover, unqualified rows dimmed.
2. **Open slots truncated** at 112px ("4p–…"). Now: role over time.
3. **A draft week was a wall of stripes.** Now: one note when 85% or more is unpublished.
4. **A toast blocked sheet buttons.** A toast that outlived its action sat above the next sheet and swallowed taps. Toasts now sit
   under the scrim.
5. **The strip bars are not touch targets.** About 6px wide on a phone. Each week is now one 44px target.
6. **"Weekdays" copy must skip conflicts.** Otherwise it books someone twice. It skips blocked days and says how many.
7. **A long press swallowed the next 500ms of taps.** Suppression now ends when the finger lifts.
8. **The Saturday header wrapped** (open count plus event tag). The event now has its own line.

## 13. Verification and limits

**Verified** in Chromium with 92 scripted checks and zero console errors. 65 run the main flows (desktop, and a touch-emulated
phone at 390 × 844) and were run twice, on the standalone file and on the published fragment inside its page skeleton. The other 27
cover multi-select, long-press, inspector edits, headcount, Offer and Assign, the request side effects, the empty-week starters and the
Month lenses. They include no horizontal page scroll, light and dark, a viewer-forced theme, and the touch-target audit in §10.

**Not verified**

- Real devices, real touch feel, screen readers, and rendering under the Google Fonts face.
- Scale. The sample is 16 people. Phase 1 designs for 50 and more, and Day, Week and Month must be measured there.
- Performance of the coverage endpoint across many locations.

**Prototype limits**

- Every slot is its own shift. The real model has capacity and assignees, and the UI groups them.
- No backend, no drag, no landing-week chip, no first-run hints. Time and More are stubs.
- The worker app is not covered.

## 14. Worker universe (deferred; direction only)

Four tabs: **Today · Schedule · Open · Inbox**. A Today hero card whose one button changes with the moment
(Directions → Clock in → Clock out → Fix a time), a week list with a month of dots, and the schedule cached for offline use.

**Fix first when the worker side starts** (found in the code):

- **Home can drop upcoming shifts.** `packages/scheduling-timekeeping/src/modules/time-tracking/worker-all-shifts.ts:109-110`
  orders ascending with a limit and no date filter, so a worker with about 50 past shifts stops seeing new ones.
- **Times use the phone's timezone, not the site's,** and the worker shift DTO carries no timezone.
- Reminder pushes carry `screen` and `shiftId`, but the app only reads `url`, so tapping one does not open the shift.
- The notification settings screen keeps its toggles in local state only.

Parked questions: "Got it" read receipts, and same-shift teammates.

## 15. Build order

Each step ships and is useful alone.

1. **Touch fixes on the current grid:** a `TouchSensor` with a press delay, `touch-action`, 44px chips on coarse pointers, a tappable `+N`.
2. **Select → act → place** on top of `planMove`, `planRemove` and `checkPerson`. Action bar, place mode, **Copy to days**, **Give to…**.
3. **Inspector** with the summary state, replacing the toolbar counters.
4. **Coverage endpoint**, then the **Horizon strip** and **Month**.
5. **Day** (timeline on desktop, dayparts on phone).
6. **Phone layouts and PWA:** Week rows, People lens, bottom sheets, bottom tabs, safe areas.
7. **Inbox** merging requests and timesheets; move past shifts and approval to Time.
8. **Playwright** `scheduler.spec.ts` for the flows in §1. Phase 1 names it; none exists yet.

## 16. Risks and open questions

- **Timesheet approval** is dead today (`timesheet/client.tsx` never passes `onApprove`). Do not put it in the Inbox until it works.
- **Capacity is not demand.** Managers will ask for "minimum two servers on Friday". That is a rules model, and a later phase.
- **Scale.** Fifty-plus people need the department sections and row virtualization from phase 1 in the new grid.
- **Brand red and problem red** are close. Keep the icon and text on Problem, and test with color-blind users.
- **Phone Move is day-only.** Changing the person is a second step. If managers find that slow, add the person picker to the same sheet.
- Open: should the strip cover 6 weeks or 8? Should the week auto-jump be a setting?
