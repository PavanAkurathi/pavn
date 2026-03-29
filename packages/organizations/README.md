# Organizations

`@repo/organizations` owns organization-level business logic.

This is the package for business setup and org-scoped configuration.

## Responsibilities

- organization settings
- attendance verification policy configuration
- location CRUD
- location geocoding entry points
- location retrieval for settings and scheduling surfaces

## Source Layout

- `src/modules/settings`
  - get/update organization settings
- `src/modules/locations`
  - create, update, delete, list, and geocode locations
- `src/schemas.ts`
  - shared location/settings validation schemas
- `src/index.ts`
  - public exports

## Boundaries

This package should contain:

- business profile setup
- timezone and attendance policy updates
- first-location onboarding support
- location retrieval

This package should not contain:

- shift publishing or approvals
- workforce invites or availability
- clock in/out enforcement

Use:

- `@repo/gig-workers` for workforce/roster behavior
- `@repo/scheduling-timekeeping` for shifts and timesheets
- `@repo/geofence` for attendance verification behavior
