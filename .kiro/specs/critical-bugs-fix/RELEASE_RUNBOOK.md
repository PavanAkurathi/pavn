# Release Runbook

## Goal

Ship the scheduling launch without exposing unfinished surfaces or missing runtime configuration.

## Pre-Deploy

1. Confirm scope: billing, certification upload, and other hidden surfaces stay disabled unless explicitly enabled.
2. Set env vars using [ENVIRONMENT_MATRIX.md](/Users/av/Documents/pavn/.kiro/specs/critical-bugs-fix/ENVIRONMENT_MATRIX.md).
   For the worker app, use [EAS_SETUP.md](/Users/av/Documents/pavn/apps/workers/EAS_SETUP.md) so preview/production builds get the right `EXPO_PUBLIC_*` values.
3. Run the release preflight:

```bash
npm run release:preflight
```

4. The preflight now includes the automated manager/worker lifecycle E2E in [lifecycle.spec.ts](/Users/av/Documents/pavn/packages/e2e/tests/api/lifecycle.spec.ts).
5. Build the worker app with production `EXPO_PUBLIC_*` values, not local fallbacks.

## Staging Deploy

1. Deploy the API/web build to staging.
2. Apply database migrations in staging.
3. Run the public smoke checks against staging:

```bash
npm run release:smoke -- --base-url=https://staging-api.example.com
```

4. Confirm `/ready` returns `200` before continuing.

## Staging Manual Smoke

Run the detailed checklist in [STAGING_LIFECYCLE_SMOKE.md](/Users/av/Documents/pavn/.kiro/specs/critical-bugs-fix/STAGING_LIFECYCLE_SMOKE.md).

Minimum pass items on real iPhone and Android devices:

1. Login via SMS OTP and restart the app. Session should persist.
2. Open the shifts tab. `All orgs` should show the worker's cross-org feed without leaking foreign-org detail to managers.
3. Publish a schedule with a same-org location. Reject a foreign-org location id.
4. Assign a worker who has a cross-org conflict. The assignment should succeed and the worker should receive an in-app notification to resolve it.
5. Enter the venue geofence and confirm the arrival banner/push behavior appears in the app.
6. Clock in on-site, fail clock-in off-site, then clock out on-site.
7. Mark `no_show` and manual timesheet edits from the manager side inside the same org only.
8. Submit a correction request and review it as a manager.

## Production Deploy

1. Freeze to bug-fix-only changes.
2. Confirm production secrets are set in the platform, not the repo.
3. Deploy API/web first.
4. Run:

```bash
npm run release:smoke -- --base-url=https://production-api.example.com
```

5. Promote the Expo build only after the API is healthy and ready.

## Post-Deploy Watch

Watch these immediately after deploy:

- `/health` and `/ready`
- auth failures and OTP delivery failures
- clock-in / clock-out errors
- push registration and notification delivery failures
- cross-org staffing and publish errors

See [MONITORING_NOTES.md](/Users/av/Documents/pavn/.kiro/specs/critical-bugs-fix/MONITORING_NOTES.md) for the current hooks.

## Rollback

Rollback immediately if `/ready` is not healthy, tenant isolation regresses, or clock in/out breaks.

1. Revert the API/web deploy to the previous release artifact.
2. Pause mobile rollout if the server contract changed.
3. Restore the database from a known-good snapshot only if the migration itself caused corruption or unrecoverable failures.
4. Re-run `npm run release:smoke` on the restored target before reopening traffic.
