# API-First Backend Blueprint

## Goal

Turn `pavn` into an API-first system where:

- business rules live in the backend
- Hono is the only product-facing entrypoint into that backend
- web and mobile render from API responses
- web and mobile do not import database code or backend business logic

This is the target operating model:

```text
apps/web + apps/gig-workers
    ->
apps/api (Hono transport + auth/session/org context + HTTP)
    ->
backend use cases / application services
    ->
domain rules
    ->
database + external providers
```

## Terms

- Backend: the whole server-side system.
- API: the Hono layer in `apps/api`.
- Application services / use cases: backend workflows such as publish schedule, invite worker, create location, clock in, approve timesheet.
- Domain logic: the business rules behind those use cases.
- Infrastructure: database, Better Auth, Stripe, Twilio, Expo push, email, logging.
- Contracts: the request/response schemas and DTOs shared between API and UI.

## Current Repo Against The Target

### What already matches the target

- `apps/api` already exists as a Hono edge and owns auth/session/org middleware in `apps/api/src/index.ts`.
- Large parts of business logic already live behind route handlers in backend packages:
  - `packages/scheduling-timekeeping`
  - `packages/organizations`
  - `packages/geofence`
  - `packages/billing`
  - `packages/notifications`
- Mobile is already close to the target. `apps/gig-workers` mostly talks to the backend over HTTP through:
  - `apps/gig-workers/lib/api.ts`
  - `apps/gig-workers/lib/auth-client.ts`
  - `apps/gig-workers/lib/worker-auth.ts`
  - `apps/gig-workers/lib/organization-context.ts`
- The scheduling and geofence domains already look like real backend services instead of page-level logic.

### What does not match the target yet

- The web app still bypasses the API and behaves like part of the backend.
- `apps/web` imports `@repo/database` directly in many product files, including:
  - `apps/web/lib/onboarding.ts`
  - `apps/web/actions/locations.ts`
  - `apps/web/actions/organization.ts`
  - `apps/web/actions/workers/invite.ts`
  - `apps/web/app/(protected)/dashboard/schedule/create/page.tsx`
  - `apps/web/app/(protected)/rosters/page.tsx`
  - `apps/web/app/(protected)/workers/[id]/page.tsx`
  - `apps/web/app/(protected)/settings/[[...tab]]/page.tsx`
- The web app also duplicates backend routes with Next API handlers in:
  - `apps/web/app/api/organizations/[orgId]/crew/route.ts`
  - `apps/web/app/api/organizations/[orgId]/locations/route.ts`
  - `apps/web/app/api/organizations/[orgId]/members/route.ts`
  - `apps/web/app/api/internal/onboarding-status/route.ts`
- Auth is split between two app surfaces:
  - `apps/api/src/index.ts` hosts Better Auth handlers
  - `apps/web/app/api/auth/[...all]/route.ts` also hosts Better Auth handlers
- Some Hono routes are still doing database work directly instead of calling backend services:
  - `apps/api/src/routes/preferences.ts`
  - `apps/api/src/routes/manager-preferences.ts`
  - `apps/api/src/routes/devices.ts`
- Billing mutations are explicitly not in the API yet. `apps/api/src/routes/billing.ts` returns `501` for checkout/portal-style mutations while the web app calls billing code directly.

## Non-Negotiable Boundary Rules

These rules define the target architecture.

1. `apps/api` is the only product entrypoint into backend business behavior.
2. `apps/web` and `apps/gig-workers` may not import `@repo/database` for product features.
3. `apps/web` and `apps/gig-workers` may not import backend business packages for product behavior.
4. UI apps may depend on API clients and shared contracts only.
5. Backend packages may not import Hono `Context`, Next `Request`/`Response`, or route wiring code.
6. Hono route handlers must stay thin:
   - validate input
   - resolve auth/session/org context
   - call use cases
   - map domain errors to HTTP responses
7. Only backend processes may import infrastructure directly:
   - `apps/api`
   - background workers
   - jobs
8. API responses should return DTOs and view models, not raw table shapes.
9. Multi-tenant context remains backend-owned. UIs do not infer authorization rules themselves.
10. New feature work follows the sequence: contract -> backend use case -> API route -> UI consumption.

## Target Layer Map

The minimal target for this repo is:

```text
apps/web                UI client only
apps/gig-workers        UI client only
apps/api                Hono API only

packages/contracts      shared DTOs and request/response schemas
packages/scheduling-timekeeping
packages/organizations
packages/geofence
packages/billing
packages/workforce      rename from packages/gig-workers
packages/auth
packages/database
packages/notifications
packages/email
packages/observability
packages/utils
```

Notes:

- The existing backend packages can stay. This does not require a clean-room rewrite.
- The immediate architectural win is to enforce `UI -> API -> backend packages`.
- A deeper split into `domain`, `application`, and `infrastructure` can happen later inside packages if needed.

## API Design Rules

The API should not just mirror tables. It should expose use cases and view models.

Good API shapes:

- `GET /shifts/upcoming`
- `GET /shifts/:id`
- `POST /shifts/publish`
- `GET /organizations/roster-view`
- `GET /organizations/worker/:id`
- `GET /organizations/onboarding`
- `POST /organizations/crew/invite`
- `POST /billing/checkout-session`

Bad API shapes:

- generic table dumps
- UI code reaching into `db`
- web-only server actions owning business behavior

For this repo, keep `x-org-id` as the tenant mechanism for now. Do not mix a new tenant model into the migration unless it becomes a blocker.

## Contracts Strategy

Add a new package:

```text
packages/contracts
```

Initial contract modules:

- `packages/contracts/src/shifts.ts`
- `packages/contracts/src/organizations.ts`
- `packages/contracts/src/workforce.ts`
- `packages/contracts/src/onboarding.ts`
- `packages/contracts/src/billing.ts`
- `packages/contracts/src/preferences.ts`
- `packages/contracts/src/index.ts`

Seed this package from existing schemas instead of inventing everything from scratch:

- `packages/scheduling-timekeeping/src/schemas.ts`
- `packages/organizations/src/schemas.ts`
- `packages/gig-workers/src/schemas.ts`

Rule:

- UI apps import contracts
- API routes import contracts
- backend packages may use contracts at boundaries, but they should not depend on UI code

## Migration Phases

### Phase 0: Freeze The Boundary

- Stop adding new direct `db` imports to `apps/web`.
- Stop adding new Next API routes that duplicate Hono.
- Treat `apps/web` and `apps/gig-workers` as clients from this point forward.

### Phase 1: Introduce Contracts

- Create `packages/contracts`.
- Move or duplicate screen-facing schemas and DTOs into that package.
- Update API and UI code to consume contracts from one place.

### Phase 2: Consolidate Auth Behind The API

- Pick one canonical Better Auth host.
- For an API-first system, that host should be `apps/api`.
- Remove the web app as a second auth server once callers are moved.

### Phase 3: Migrate Web Reads To The API

- onboarding
- roster pages
- worker detail pages
- settings data
- schedule creation bootstrap data

### Phase 4: Migrate Web Mutations To The API

- locations
- organization settings
- invites
- worker management
- team management
- billing checkout and portal

### Phase 5: Thin Hono And Clean Package Boundaries

- extract direct route-level DB logic into backend services
- rename misleading packages
- add CI guardrails so the boundary does not regress

## First 10 Refactors In Order

These are the first concrete changes to make.

### 1. Add `packages/contracts`

Purpose:

- make API contracts a first-class layer
- stop UI apps from importing backend package types ad hoc

Work:

- create `packages/contracts`
- add initial modules for shifts, organizations, workforce, onboarding, billing, and preferences
- seed the first pass from:
  - `packages/scheduling-timekeeping/src/schemas.ts`
  - `packages/organizations/src/schemas.ts`
  - `packages/gig-workers/src/schemas.ts`

Success condition:

- web and mobile can import DTOs from `@repo/contracts`

### 2. Move onboarding into the API

Current leak:

- `apps/web/lib/onboarding.ts` computes backend onboarding state directly with `db`
- `apps/web/app/api/internal/onboarding-status/route.ts` exposes a Next-only backend route
- `apps/web/proxy.ts` depends on that internal route

Refactor:

- add a backend use case, ideally under `packages/organizations`
- add a Hono endpoint for onboarding state
- replace `apps/web/lib/onboarding.ts`
- replace `apps/web/app/api/internal/onboarding-status/route.ts`
- update `apps/web/proxy.ts` to call Hono instead

Success condition:

- onboarding state is computed only in the backend and fetched over the API

### 3. Consolidate Better Auth under `apps/api`

Current split:

- `apps/api/src/index.ts` handles `/api/auth/*`
- `apps/web/app/api/auth/[...all]/route.ts` also handles auth

Refactor:

- make `apps/api` the canonical auth host
- update callers and client configuration in:
  - `packages/auth/src/env.ts`
  - `packages/auth/src/client.ts`
  - `apps/web/lib/server/auth-context.ts`
  - `apps/web/proxy.ts`
- retire `apps/web/app/api/auth/[...all]/route.ts` after the cutover

Success condition:

- there is one auth server surface, not two

### 4. Move location reads and writes fully behind Hono

Current leak:

- `apps/web/actions/locations.ts` calls backend services and `db` directly
- `apps/web/app/api/organizations/[orgId]/locations/route.ts` duplicates backend behavior
- settings pages read locations directly

Refactor:

- use `apps/api/src/routes/organizations.ts` as the only HTTP surface
- keep logic in `packages/organizations/src/modules/locations/*`
- replace `apps/web/actions/locations.ts`
- delete `apps/web/app/api/organizations/[orgId]/locations/route.ts`
- update settings consumers to fetch from Hono

Success condition:

- all location management goes through Hono

### 5. Move organization settings and onboarding metadata writes behind Hono

Current leak:

- `apps/web/actions/organization.ts` owns business mutations directly

Refactor:

- expose the required mutations from `apps/api/src/routes/organizations.ts`
- keep the write logic in `packages/organizations/src/modules/settings/*`
- add any missing backend use case for onboarding metadata updates such as `markBillingPromptHandled`
- replace `apps/web/actions/organization.ts`

Success condition:

- organization settings are updated through the API, not web server actions

### 6. Move billing mutations behind Hono

Current leak:

- web billing actions call `@repo/billing` directly:
  - `apps/web/actions/billing/checkout.ts`
  - `apps/web/actions/billing/portal.ts`
  - `apps/web/actions/billing/subscription.ts`
  - `apps/web/actions/billing/invoices.ts`
- `apps/api/src/routes/billing.ts` explicitly says mutations are still handled in the web app

Refactor:

- add checkout-session and portal-session endpoints to `apps/api/src/routes/billing.ts`
- keep Stripe logic in `packages/billing`
- make web billing UI call the API instead of billing packages directly

Success condition:

- billing reads and writes both live behind the API

### 7. Move crew, worker, and team mutations behind Hono

Current leak:

- worker and team flows live in web server actions:
  - `apps/web/actions/workers/invite.ts`
  - `apps/web/actions/workers/bulk-invite.ts`
  - `apps/web/actions/workers/remove.ts`
  - `apps/web/actions/team/add.ts`
  - `apps/web/actions/team/bulk-import.ts`
  - `apps/web/actions/team/remove.ts`
  - `apps/web/actions/invites.ts`

Refactor:

- expand `apps/api/src/routes/organizations.ts` where needed
- keep business logic in:
  - `packages/gig-workers/src/modules/roster/*`
  - `packages/gig-workers/src/modules/members/*`
  - `packages/auth`
- replace the web server actions with API calls

Success condition:

- team and workforce mutations no longer run inside the web app

### 8. Add roster and worker-profile read models to the API

Current leak:

- `apps/web/app/(protected)/rosters/page.tsx` assembles a large roster view directly from `db`
- `apps/web/app/(protected)/workers/[id]/page.tsx` reads worker profile data directly from `db`
- `apps/web/app/(protected)/settings/[[...tab]]/page.tsx` assembles locations, team members, sessions, accounts, and invites directly in the page

Refactor:

- add screen-shaped read endpoints in Hono for:
  - roster list
  - worker profile
  - workspace settings view
- keep mapping logic in backend packages, not page files
- move page data loading to API clients

Success condition:

- web pages render from API view models, not ad hoc database joins

### 9. Add a schedule-create bootstrap endpoint

Current leak:

- `apps/web/app/(protected)/dashboard/schedule/create/page.tsx` mixes API calls with direct `db` reads for crew and role bootstrap data

Refactor:

- add one Hono endpoint that returns the full create-schedule bootstrap payload:
  - draft shifts
  - crew list
  - worker roles
  - locations if needed
- keep the orchestration in backend services
- simplify the page into a pure API consumer

Success condition:

- the schedule-create screen renders from one backend payload

### 10. Thin the remaining Hono routes and enforce the boundary in CI

Current leak:

- `apps/api/src/routes/preferences.ts`
- `apps/api/src/routes/manager-preferences.ts`
- `apps/api/src/routes/devices.ts`

These routes still do their own DB work.

Refactor:

- extract those behaviors into backend services
- keep Hono handlers thin
- add a lint or CI rule that blocks:
  - `apps/web` importing `@repo/database`
  - `apps/web` importing backend business packages for product behavior

Cleanup after this step:

- rename `packages/gig-workers` to `packages/workforce`

Success condition:

- route handlers are transport-only
- the UI/backend boundary cannot silently regress

## Definition Of Done

This migration is complete when all of the following are true:

- `apps/web` has no product-path imports from `@repo/database`
- `apps/web` has no product-path imports from backend business packages
- `apps/web/app/api/organizations/*` is gone
- `apps/web/app/api/internal/onboarding-status/route.ts` is gone
- `apps/web/app/api/auth/[...all]/route.ts` is gone or reduced to a temporary proxy only
- billing mutations exist in Hono
- onboarding, roster, worker profile, settings, and schedule-create all load from API responses
- Hono route handlers no longer contain business queries except app bootstrapping and middleware-level auth context

## Recommended Naming Cleanup

The current package name `packages/gig-workers` is misleading because it is backend workforce logic, not the mobile app.

Rename it to:

```text
packages/workforce
```

Do this after API migration work starts so the rename does not overlap with the boundary rewrite.

## Guiding Principle

The backend should be the source of truth for:

- permissions
- onboarding state
- organization context
- roster state
- scheduling rules
- timekeeping rules
- billing state
- notification state

The UIs should be the source of truth only for:

- presentation
- interaction flow
- local loading state
- optimistic updates when safe

That is the architecture this repo should converge to.
