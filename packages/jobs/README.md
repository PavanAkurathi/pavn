# Jobs

`@repo/jobs` owns background workflows that compose the domain packages.

## Responsibilities

- scheduled notification jobs
- timesheet follow-up jobs
- cleanup jobs
- dispute/supporting async workflows

## Source Layout

- `src/jobs/notifications.ts`
- `src/jobs/timesheets.ts`
- `src/jobs/cleanup.ts`
- `src/jobs/disputes.ts`

## Boundary Rule

This package should orchestrate work across packages.

It should not become the home of primary business logic that belongs in:

- `@repo/scheduling-timekeeping`
- `@repo/gig-workers`
- `@repo/geofence`
- `@repo/organizations`
