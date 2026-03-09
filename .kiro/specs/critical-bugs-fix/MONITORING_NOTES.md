# Monitoring Notes

## API

- `SENTRY_DSN` enables server-side exception capture through [packages/observability/src/index.ts](/Users/av/Documents/pavn/packages/observability/src/index.ts).
- [apps/api/src/index.ts](/Users/av/Documents/pavn/apps/api/src/index.ts) now:
  - initializes Sentry during startup when configured
  - logs startup readiness status
  - logs any `5xx` response and any `/ready` `503` response to the observability tracker

## Worker App

- `EXPO_PUBLIC_SENTRY_DSN` enables mobile crash reporting in [apps/workers/app/_layout.tsx](/Users/av/Documents/pavn/apps/workers/app/_layout.tsx).
- EAS environments should hold the public DSN for `preview` and `production`.

## External Checks

- Probe `/health` for uptime.
- Probe `/ready` for release readiness.
- Alert on repeated `/ready` `503` responses, auth failure spikes, push registration spikes, and geofence `5xx` errors.
