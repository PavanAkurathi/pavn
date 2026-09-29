# Manager Scheduling — Phase 3: Touch-first redesign

Changes two earlier decisions: the grid is no longer desktop-only ([`phase-1-plan.md`](./phase-1-plan.md)),
and phone triage is replaced by a real Day / Week / Month on phones
([`phase-2-manager-landing.md`](./phase-2-manager-landing.md), §3 and §4 are superseded by this document).

**Clickable prototype:** [`prototype-v2.html`](./prototype-v2.html). Open it in a browser and use the
Desktop / Phone switch at the top. It uses sample data and saves nothing. Its working title is "Horizon Schedule".
Resize the window to see the three width tiers (§5). The sun or moon icon at the top right is the theme control (§10).

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
| **No charts** | **Owner feedback: no graphs.** Everything is words, counts and tags. No bars, ribbons, meters, timelines or heatmaps. |

## 1. Try the prototype

| Try this | What it shows |
|---|---|
| Desktop: click a shift, then **Move**. | The grid dims and every cell gets ✓ / ⚠ / ✕. Hover a cell for the reason. |
| Desktop: click a shift, then **Copy**, then **Weekdays**, then **Done**. | Copy to many days in one action. Days that would be blocked are skipped and counted. |
| Click an empty cell, then a **usual shift** chip. | Creating a shift in two taps. Type `4-11` to see the live parse. |
| Click an open slot in the Open row. | The inspector has *How many people*, *Who can take it* and **Offer** to matching workers. |
| Tap **Next week** in the row at the top. | See that next week has 16 open slots and is a draft, without opening it. |
| **Month**, then the *Time off*, *Events* and *Drafts* lenses, then **List**. | One question at a time, and the same data as a list. |
| Phone: **Week**, **People**, then tap a person. | A phone-sized way to schedule by person, with no grid. |
| Phone: tap a shift, then **Move** or **Copy**. | Day chips instead of dragging. |
| Inbox, then **Approve** on Cara's time off, then back to Schedule. | A decision with a consequence: it creates a conflict, and the week says so. |
| Press `1` `2` `3`, `m` `c` `g` `o`, `z`, `Esc`. | The keyboard covers the same actions. |
| Make the window 960px wide, then tap **2 problems · 8 open** in the toolbar. | The details panel is a drawer that opens on request, so the grid keeps the full width. |
| Tap the sun or moon icon. | Light and dark follow your local time (light 7am to 7pm). A click overrides it and the choice sticks. |

## 2. Principles

Each principle rules something out.

1. **Every action has a tap path.** Drag is a shortcut, never a requirement (WCAG 2.2 SC 2.5.7, Dragging Movements).
2. **One canvas, three zooms.** Day, Week and Month share one date and one set of filters, so zooming never loses your place.
3. **Gaps before people.** The first question is "am I covered?", and the answer is a word or a number: *Covered*, *8 open*.
4. **One question at a time.** A lens shows one thing: open slots, time off, events or drafts. Never all of them.
5. **A clutter budget.** Three marks on a shift, one number per day, six controls in the toolbar.
6. **Same content, three containers.** The inspector is a docked panel on a wide desktop, a drawer on a narrower one, and a bottom sheet on a phone.
7. **No charts.** If a number or a word says it, do not draw it.
8. **Everything is undoable.**

## 3. Information architecture

**Schedule · People · Inbox · Time.** Settings sit under the avatar.

- There is no separate Shifts list. Upcoming lives in Schedule. Past shifts and timesheet approval live in Time.
  This removes the "two places to see shifts" confusion.
- **Inbox** is the one place for everything waiting on the manager: claims, drops, swaps, time off and timesheets.
  It carries one badge.
- Phone: bottom tabs **Schedule · Inbox · People · Time**.

## 4. Weeks ahead

A row of six week chips, always visible above the toolbar. Each chip is two lines of text. It is how a manager sees a hole
three weeks out without opening anything, and it replaces the phase-2 "needs you" strip.

```
WEEKS AHEAD  [This week      ] [Next week      ] [Oct 11 – 17    ] [Oct 18 – 24  ] [Oct 25 – 31  ]
             [8 open · 14 drafts] [16 open · Draft] [11 open · Draft] [Not started ] [Not started ]
```

| Status text | Meaning |
|---|---|
| `Covered` | Every slot is filled |
| `8 open` | Slots still empty, in the warning color |
| `· 14 drafts` | Some shifts are unpublished. Workers can't see them yet |
| `· Draft` | The whole week (85% or more) is unpublished |
| `Not started` | Nothing scheduled |

- The dark chip is the week you are viewing. Tap a chip to jump there; from Day it keeps the weekday you were on.
- The row scrolls sideways inside itself on a phone. Each chip is at least 44px tall. Its accessible name is
  `Jump to next week: 16 open · Draft`.
- There is no legend, because there is nothing to decode.

## 5. Three zooms

| Zoom | Desktop (≥920px) | Phone |
|---|---|---|
| **Day** | A headline (`8 on shift · 1 open`, with *Gaps* or *Covered*), then a column per daypart: Morning, Evening. Each column says `2 of 2` and lists people, then open slots with **Assign** and **Offer**. | The same, stacked. |
| **Week** | People × days grid, or **By role** (`4p–11p 3/4` per cell). Each day header says `N open` and names the event. | Seven day rows: `11 of 12 filled`, `1 open`, `Draft`. **People** lens: a row per person, `5 shifts · Sun Mon Tue Fri`, with tags for problems, drafts and days off. Tapping a person opens their week in a sheet. |
| **Month** | A calendar of numbers. Each day shows `9 on` (people working) or `2 open` in orange. A gutter per week says *Live*, *N drafts* or *Not started*. | The same, sized for a thumb. |

**Month lenses.** Coverage, Time off, Events, Drafts. One at a time. **List** shows the same days as rows.
Tapping a day opens a peek (desktop: the inspector; phone: a sheet) with **Open day** and **Open week**.

**Daypart names** come from shift start times: before 11:00 Morning, 11:00–14:59 Midday, 15:00–21:59 Evening, 22:00 on Late.
Presets can rename them per business type.

**Landing.** Phone opens Day if today has shifts, else Week. Desktop opens Week using the time-aware rule from phase 2
(this week, or next week when this week is clean and next is empty or has drafts), with a visible "Showing next week · Back" chip.
The prototype does not implement that chip.

### Responsive tiers and the panel

The first version docked the details panel (332px) on every desktop-sized window. In a 960 × 540 window, which is a normal laptop
with the browser not maximised, the panel took a third of the width, the grid needs 1000px, and the Thu, Fri and Sat columns
disappeared behind it. The panel is now closed until needed, and it only docks when there is room.

| Width | Layout | Details panel |
|---|---|---|
| ≥ 1280px | Desktop | Docked beside the grid, with a collapse button and a **Details** edge tab to bring it back. The choice is remembered in this browser. |
| 920 – 1279px | Desktop | **Not docked.** A drawer from the right, `min(380px, 92%)` wide, opened by **Details** in the action bar or by the **Needs a look** chip in the toolbar. Esc, a tap outside, or ✕ closes it. |
| < 920px | Phone | Bottom sheets, as before. |

- **Selecting a shift never opens the drawer.** Move and Copy keep the whole grid visible. The panel opens only when asked for.
- **The grid fits 920px.** Name column 148px, seven day columns of at least 96px, hours column 60px: 880px plus the 20px page gutter.
  There is no sideways scroll at 920px and up.
- **The toolbar stays one row below 1280px.** *Needs attention only* and the By person / By role switch move into the ⋯ menu, as on the
  phone. The **Needs a look** chip (`2 problems · 8 open`) takes their place and opens the drawer. **Publish N** stays last and never wraps.
- **Short windows.** Under 700px of height the weeks-ahead chips, top bar, tabs and toolbar are compacted. In a 540px-high window the
  grid now starts at 181px, including the 34px preview bar, where it used to start at about 226px and left barely two rows of people.
  Without the preview bar the chrome is about 147px.

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
- A day selected (header or month cell): `9 of 10 filled`, dayparts, **Open day**, **Open week**.
- Desktop, 1280px and wider: a docked right panel that can be collapsed. Desktop, 920 to 1279px: a drawer opened on request (§5).
  Phone: a bottom sheet from the action bar's **Details** or a second tap on the selected shift.

## 8. The clutter budget

- **No charts.** A bar, a ribbon, a meter, a timeline or a heatmap is a chart. The first version of this design had all five;
  every one was replaced by words and numbers (§12).
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
| Loading | The grid comes from the server render. The weeks-ahead row and Month stream in after first paint. |
| Weeks-ahead data fails | The row is hidden. The grid is unaffected. |
| No location, no team | The existing notices, each with a button. |
| Multi-location | A dot on the location select when another location needs attention. |

## 10. Accessibility

- WCAG 2.2 **2.5.7**: every drag has a tap or keyboard path.
- **Touch targets.** On a 390px-wide phone every control is at least 44px, audited by script across Day, Week (Days and People),
  Month, the Month list, Inbox, People and the shift-details sheet. Stated plainly, the exceptions are: the Month week gutter is
  36px wide and reaches 44px through a hit area that extends into the page margin, and on a 360px phone the Month day cells
  are about 41px wide (60px tall). All clear the WCAG 2.5.8 minimum of 24px.
- Color is never alone: marks have shapes and text, every status is a word, and nothing needs a legend.
- Role colors: worst adjacent color-blind separation ΔE 9.1 (light) and 8.4 (dark), normal-vision floor 19.6 and 19.3.
- Every shift and every day has an aria-label that states person, time, role and marks. Toasts use `role="status"`.
  The week chip and the toolbar arrow have different names (`Jump to next week: …` and `Next week`).
- Reduced motion turns off the sheet and toast animation. Forced-colors keeps dashed outlines.

### Theme: automatic by time, one icon to override

The Auto / Light / Dark tabs are gone. One icon button replaces them: a **sun** when the page is light, a **moon** when it is dark.

- **Rule.** The theme follows the viewer's local clock, which already reflects their time zone. Light from 07:00 to 18:59, dark otherwise.
  It is evaluated on load, at every 07:00 and 19:00 while the page is open (a timer), and when the tab becomes visible again.
  The same instant is light in New York (10:00) and dark in Tokyo (23:00).
- **Override.** A click flips the theme and remembers the choice in this browser (`localStorage`, in a try/catch; with storage blocked the
  choice lasts until the page is closed). A click that lands on what automatic would show right now clears the choice, so
  clicking twice returns to automatic. There is no third state to learn.
- **Semantics.** A toggle button with `aria-pressed` (true = dark) and a stable name, *Dark theme*. A description says how the current
  state came about, for example *Dark theme, automatic: dark from 7pm to 7am. Click to switch.* or *Light theme, set by you.* The same text
  is the tooltip. The tap area is 44 × 44 on a phone.
- **No flash.** A small inline script sets the theme before first paint. A theme forced by the host page is respected until the icon is clicked.
- **Stated limit.** True sunrise and sunset need a location, and geolocation is blocked in the viewer. The hours are fixed. Per-business or
  per-user hours are a later setting. In the product the icon belongs in the top bar or the user menu, not a preview bar.

## 11. Data and platform

**Exists**

- `SchedulerWeek` (`packages/contracts/src/scheduler.ts:154`): people, shifts, events, time off, unavailable, and `summary`.
  Day and Week views derive everything per day from it. No new API for those.
- The requests and approval routes under `/scheduler`, and the ranking in `lib/scheduler/candidates.ts`.

**New**

- **`GET /scheduler/coverage?locationId&from&to`** returns per day `{ capacity, filled, open, draftCount, eventCount, timeOffCount }`.
  Aggregate SQL, not full weeks. It feeds the weeks-ahead row (summed per week), Month and the landing rule. It returns numbers only.
  Layering per `docs/architecture/api-first-backend-blueprint.md`: contract in `packages/contracts/src/scheduler.ts`, use case in
  `packages/scheduling-timekeeping/src/modules/scheduler/`, thin route in `apps/api/src/routes/scheduler.ts`, SWR client in
  `apps/web/lib/scheduler/client.ts`.
- **Limit, said plainly:** "capacity" means slots to fill, not forecast demand. There is no minimum-staffing rule model yet,
  so *covered* means every slot is filled.

**Web platform work**

- PWA manifest (installable to the home screen), `viewport-fit=cover`, safe-area insets, `dvh` instead of `vh`, and
  `@media (pointer: coarse)` for 44px targets.
- Bottom sheets from the existing `@repo/ui` `drawer`.
- `apps/web/AGENTS.md` warns that this Next.js has breaking changes. Read `node_modules/next/dist/docs/` before building.

## 12. What building the prototype taught us

These changed the design. They are the reason to test a design before building it.

1. **No charts (owner feedback).** The first version had a six-week bar strip, an hourly headcount ribbon on Day, a fill meter on
   every day and daypart, a shaded Month heatmap and a Gantt-style Day timeline. All were removed. The strip became six text chips,
   Day became daypart columns, Month became a calendar of numbers, and the phone People row lost its strip of colored cells.
   Nothing was lost: every one of them showed a number that is now printed.
2. **Place mode was unreadable.** Role mismatch counts as a warning, so most cells lit up amber with a sentence each.
   Now: glyphs only, reasons on hover, unqualified rows dimmed.
3. **Open slots truncated** at 112px ("4p–…"). Now: role over time.
4. **A draft week was a wall of stripes.** Now: one note when 85% or more is unpublished.
5. **A toast blocked sheet buttons.** A toast that outlived its action sat above the next sheet and swallowed taps. Toasts now sit
   under the scrim.
6. **"Weekdays" copy must skip conflicts.** Otherwise it books someone twice. It skips blocked days and says how many.
7. **A long press swallowed the next 500ms of taps.** Suppression now ends when the finger lifts.
8. **The Saturday header wrapped** (open count plus event tag). The event now has its own line.
9. **Two controls shared one name.** The new "Next week" chip and the toolbar's "Next week" arrow were indistinguishable to a screen
   reader. The chip is now `Jump to next week: …`.
10. **"Draft" overstated a mostly-published week.** The chip now says `14 drafts`, and reserves `Draft` for a whole unpublished week.
11. **The docked panel squeezed the grid (owner feedback).** At 960px the always-open panel hid three of seven day columns, and the owner
    read it as "Publish is blocked half the screen". The panel is now closed until needed below 1280px, and the desktop layout starts at
    920px, the width the grid needs (§5).
12. **The chrome used 40% of a short window.** Preview bar, top bar, weeks-ahead row and toolbar took about 226px of a 540px window.
    Under 700px of height they are compacted, and the toolbar is a single row (§5).
13. **Three theme tabs were a chore.** Nobody wants to choose a theme in a scheduler. It now follows the clock, and one icon overrides it (§10).

## 13. Verification and limits

**Verified** in Chromium with 208 scripted checks and zero console errors. 72 run the main flows (desktop, and a touch-emulated
phone at 390 × 844). 27 cover multi-select, long-press, inspector edits, headcount, Offer and Assign, the request side effects, the
empty-week starters and the Month lenses. 109 cover the responsive tiers and the theme: at 960 × 540 the whole week and **Publish** are
visible with the panel closed, the drawer opens and closes four ways, the panel docks at 1280 and 1440 and its collapse is remembered,
1279 is not docked and 919 is the phone layout, and the theme is right at 10:00 and 21:00 in New York and Tokyo, at 06:59, 07:00, 18:59
and 19:00, across the 19:00 and 07:00 flips of an open page, after a reload, with the pin cleared by a second click, with a host-forced
theme, and with storage blocked. The rest include no horizontal page scroll, light and dark, the touch-target audit in §10, and a
regression check that **fails if any chart-like element appears** in Day, Week, People or Month on desktop or phone.
The main and responsive suites were run twice, on the standalone file and on the published fragment inside its page skeleton.

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
Consistent with §8: words and numbers, no charts.

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
4. **Coverage endpoint**, then the **weeks-ahead row** and **Month**.
5. **Day** (daypart columns).
6. **Phone layouts and PWA:** Week rows, People lens, bottom sheets, bottom tabs, safe areas.
7. **Inbox** merging requests and timesheets; move past shifts and approval to Time.
8. **Playwright** `scheduler.spec.ts` for the flows in §1. Phase 1 names it; none exists yet.

## 16. Risks and open questions

- **Timesheet approval** is dead today (`timesheet/client.tsx` never passes `onApprove`). Do not put it in the Inbox until it works.
- **Capacity is not demand.** Managers will ask for "minimum two servers on Friday". That is a rules model, and a later phase.
- **Scale.** Fifty-plus people need the department sections and row virtualization from phase 1 in the new grid.
- **Numbers instead of pictures.** A hole two weeks out is now a number in a chip. If managers want more at a glance, add words first
  (for example the day with the most open slots) before reaching for a chart.
- **Brand red and problem red** are close. Keep the icon and text on Problem, and test with color-blind users.
- **Phone Move is day-only.** Changing the person is a second step. If managers find that slow, add the person picker to the same sheet.
- Open: should the weeks-ahead row cover 6 weeks or 8? Should the week auto-jump be a setting?
