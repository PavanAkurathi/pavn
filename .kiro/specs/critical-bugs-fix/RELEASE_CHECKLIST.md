# Release Checklist

## Scope

This checklist is for the current scheduling-focused launch. Billing, certification upload, and other non-core surfaces are not part of the launch scope unless explicitly enabled and verified.

Supporting docs:
- [Environment Matrix](/Users/av/Documents/pavn/.kiro/specs/critical-bugs-fix/ENVIRONMENT_MATRIX.md)
- [Release Runbook](/Users/av/Documents/pavn/.kiro/specs/critical-bugs-fix/RELEASE_RUNBOOK.md)
- [Staging Lifecycle Smoke](/Users/av/Documents/pavn/.kiro/specs/critical-bugs-fix/STAGING_LIFECYCLE_SMOKE.md)

## Blockers

- [ ] `packages/shifts`, `packages/geofence`, `apps/api`, and `apps/workers` typecheck clean
- [ ] targeted regression tests for publish, timesheet updates, cross-org conflicts, and API routes pass
- [ ] automated manager/worker lifecycle E2E passes locally
- [ ] staging database migration and data cleanup complete
- [ ] no worker-facing mock screens or fake success payloads remain on live navigation paths
- [ ] billing endpoints are either fully enabled or explicitly unavailable

## Staging Smoke

- [ ] manager can publish a schedule with a valid same-org location
- [ ] manager cannot publish a schedule using a foreign-org location id
- [ ] worker sees only their own shifts and correct org filters
- [ ] cross-org conflicts notify the worker but do not block staffing
- [ ] worker can clock in on-site with current GPS and cannot clock in off-site
- [ ] worker can clock out on-site and completed shift appears in history
- [ ] manager can mark `no_show` only inside their own organization
- [ ] manager can apply manual timesheet edits and approval flow completes
- [ ] worker can submit a correction request and manager can review it
- [ ] push registration succeeds and foreground arrival notifications appear in the app
- [ ] app restart preserves worker session and returns to the shifts tab

## Device Validation

- [ ] iPhone: login, app restart, push permission, push delivery, clock in/out
- [ ] Android: login, app restart, background location permission, foreground service notification, push delivery, clock in/out
- [ ] deep links and org invitations work on both platforms
- [ ] geofence arrival banner appears only when entering an active shift venue

## Launch Configuration

- [ ] production env vars are set for auth, API, Expo push, Sentry, Dub, and SMS
- [ ] Stripe/billing env vars are set only if billing is enabled for launch
- [ ] Sentry release tracking is enabled for API and Expo worker app
- [ ] health check and critical error alerts are configured
- [ ] rollback plan is written and tested for API deploy and DB migration

## Commands

```bash
npm run release:preflight
npm run release:lifecycle:local
npm run release:smoke -- --base-url=https://staging-api.example.com

# individual commands
npm run typecheck --workspace=packages/database
npm run typecheck --workspace=packages/shifts
npm run typecheck --workspace=packages/geofence
npm run typecheck --workspace=apps/api
npx tsc --noEmit -p apps/workers/tsconfig.json
npx tsc --noEmit -p packages/e2e/tsconfig.json
bun test packages/shifts/tests/update-timesheet.test.ts \
  packages/shifts/tests/worker-all-shifts.test.ts \
  packages/shifts/tests/publish.test.ts \
  packages/shifts/tests/cross-org-conflict-notifications.test.ts \
  apps/api/src/routes/shifts.test.ts
npm run test:api:lifecycle --workspace=packages/e2e
```

## Go / No-Go

- Go only if all blocker items are complete and staging smoke passes on both mobile platforms.
- No-go if any tenant isolation, clock in/out, or session persistence issue remains open.
