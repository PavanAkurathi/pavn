# Scheduling Timekeeping

`@repo/scheduling-timekeeping` owns scheduling and timekeeping.

## What lives here

- `src/modules/shifts`
  - publish, edit, cancel, duplicate, list, and group shifts
- `src/modules/time-tracking`
  - assignments, approvals, timesheets, no-shows, overlap checks
- `src/modules/reporting`
  - timesheet exports and report filters

## What does not belong here

- worker directory, availability, invites, and roster import
  - use `@repo/gig-workers`
- organization settings and locations
  - use `@repo/organizations`
