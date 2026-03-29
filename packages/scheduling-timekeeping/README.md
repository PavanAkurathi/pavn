# Scheduling Timekeeping

`@repo/scheduling-timekeeping` owns shift lifecycle, time tracking, and reporting over scheduled work.

## Responsibilities

- shift creation and publication
- drafts, upcoming, history, and grouped views
- assignments and unassignment
- approvals and timesheets
- overlap logic
- worker-facing shift feeds
- reporting and export flows

## Source Layout

- `src/modules/shifts`
  - publish, edit, cancel, duplicate, list, and grouping flows
- `src/modules/time-tracking`
  - assign/unassign, approvals, timesheets, overlap, worker shift feeds
- `src/modules/reporting`
  - report filters and export logic
- `src/middleware`
  - package-local RBAC/rate-limit helpers used by API surfaces
- `src/schemas.ts`
  - shared scheduling/timekeeping schemas
- `src/types.ts`
  - public DTOs used by apps
- `tests/`
  - package tests

## Boundaries

This package should contain:

- scheduling flows
- shift DTO shaping
- timesheet state transitions
- reports over scheduled work

This package should not contain:

- workforce directory, worker availability, or roster import
- organization settings or location CRUD
- raw attendance/geofence enforcement
