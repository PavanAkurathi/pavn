# Geofence

`@repo/geofence` owns attendance verification and location-aware timekeeping workflows.

This package is no longer just a distance utility. It contains the business logic for:

- clock in / clock out verification
- soft vs strict geofence behavior
- correction requests and review
- manager overrides
- flagged timesheet review queues
- location ingestion
- geocoding helpers used by org/location flows

## Source Layout

- `src/services/clock-in.ts`
- `src/services/clock-out.ts`
- `src/services/request-correction.ts`
- `src/services/review-correction.ts`
- `src/services/manager-override.ts`
- `src/services/flagged-timesheets.ts`
- `src/services/get-worker-corrections.ts`
- `src/services/ingest-location.ts`
- `src/services/geocode-location.ts`
- `src/schemas.ts`
- `src/utils/*`

## Boundaries

This package should contain:

- attendance verification logic
- policy-aware location checks
- correction and override flows
- geospatial helpers used by attendance workflows

This package should not contain:

- shift publishing or workforce directory logic
- organization settings ownership
- mobile-only UI validation as the source of truth
