# Organizations

`@repo/organizations` owns organization-level business logic.

## Structure

- `src/modules/settings`
  - organization settings and attendance policy updates
- `src/modules/locations`
  - CRUD, geocoding, and location retrieval
- `src/schemas.ts`
  - settings and location schemas shared with API and web
- `src/utils`
  - small package-local helpers only

## Boundaries

This package should contain:

- organization settings
- attendance policy configuration
- locations and geocoding

This package should not contain:

- shift publishing
- assignments or approvals
- worker invites or availability
