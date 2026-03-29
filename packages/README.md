# Packages Architecture

This directory holds the shared packages for the Pavn monorepo.

The practical split is:

- `apps/*` own delivery surfaces
- `packages/*` own reusable business logic, shared contracts, and infrastructure helpers

## Core Business Logic Packages

- `@repo/auth`
  - identity, session, OTP, worker eligibility, membership hydration
- `@repo/billing`
  - org-scoped subscription state, Stripe sessions, invoice history, webhook sync helpers
- `@repo/organizations`
  - business settings, attendance policy config, locations, geocoding entry points
- `@repo/gig-workers`
  - workforce roster, worker profile changes, availability, roster import/invite flows
- `@repo/scheduling-timekeeping`
  - shifts, assignments, approvals, timesheets, reports
- `@repo/geofence`
  - attendance verification, correction flows, location ingestion, geospatial enforcement
- `@repo/notifications`
  - push dispatch, scheduling, queued notification delivery
- `@repo/jobs`
  - background workflows that compose the business-logic packages

## Foundation Packages

- `@repo/database`
- `@repo/config`
- `@repo/utils`
- `@repo/observability`

## UI / Tooling Packages

- `@repo/ui`
- `@repo/eslint-config`
- `@repo/typescript-config`
- `@repo/e2e`
- `@repo/dub`
- `@repo/notification-worker`
  - worker wrapper that runs the canonical notification dispatcher from `@repo/notifications`

## Dependency Direction

Keep the direction predictable:

```text
config/database/utils/observability
    -> auth / organizations / gig-workers / scheduling-timekeeping / geofence / notifications
    -> jobs
    -> apps
```

Avoid the reverse:

- apps should not hide reusable domain logic
- domain packages should not absorb app-specific UI concerns
- one domain package should not import another unless the ownership line is clear

## Where New Code Should Go

- org settings or location behavior
  - `@repo/organizations`
- worker roster, worker profile, availability, imports, workforce invites
  - `@repo/gig-workers`
- shift creation, publishing, approvals, timesheets, reporting
  - `@repo/scheduling-timekeeping`
- attendance verification, on-site checks, corrections, overrides
  - `@repo/geofence`
- auth/session/OTP/membership hydration
  - `@repo/auth`

Choose the package by business concept, not by whichever package already has a nearby helper.

## Package Standards

For business-logic packages, keep this shape:

- `src/modules/*`
  - use case / workflow code
- `src/schemas.ts`
  - shared validation and DTO contracts
- `src/index.ts`
  - public exports only
- `tests/*`
  - package tests
- `README.md`
  - developer-facing ownership and boundary notes

Tests should live in `tests/` unless there is a strong reason to colocate them with the source.
