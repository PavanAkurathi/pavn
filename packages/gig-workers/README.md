# Gig Workers

`@repo/gig-workers` owns gig-worker and roster domain logic.

## Structure

- `src/modules/directory`
  - crew lookup and directory shaping
- `src/modules/members`
  - worker status changes and profile updates
- `src/modules/availability`
  - availability read/write logic
- `src/modules/roster`
  - invite flow, CSV/XLSX parsing, and bulk import
- `src/schemas.ts`
  - worker, crew, and availability schemas
- `src/utils`
  - role formatting and package-local helpers

## Boundaries

This package should contain:

- worker profile updates
- crew directory data
- availability
- roster import and invite preparation

This package should not contain:

- shift publishing
- clock in/out enforcement
- organization settings or locations
