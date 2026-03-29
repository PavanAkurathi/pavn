# Gig Workers

`@repo/gig-workers` owns workforce and roster domain logic.

Use this package for the people you plan to schedule, not for admin/manager access.

## Responsibilities

- worker profile updates
- worker activation/deactivation
- workforce directory / crew lookup
- worker availability
- roster import parsing
- roster-driven worker invite preparation

## Source Layout

- `src/modules/directory`
  - crew lookup and directory shaping
- `src/modules/members`
  - worker profile updates, activation, deactivation
- `src/modules/availability`
  - availability read/write flows
- `src/modules/roster`
  - CSV/XLSX parsing, bulk import, invite preparation
- `src/schemas.ts`
  - worker, crew, roster, and availability schemas
- `src/utils`
  - package-local formatting and role helpers

## Boundaries

This package should contain:

- roster and workforce setup
- job-title / role shaping for workers
- worker lifecycle updates
- availability that feeds scheduling

This package should not contain:

- manager/admin membership management
- shift publication, approvals, or reporting
- clock in/out enforcement
- organization settings or locations
