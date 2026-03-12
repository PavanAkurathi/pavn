# Release Checklist

Use this as the final go / no-go gate.

Supporting docs:

- [Environment Matrix](/Users/av/Documents/pavn/.kiro/specs/critical-bugs-fix/ENVIRONMENT_MATRIX.md)
- [Release Runbook](/Users/av/Documents/pavn/.kiro/specs/critical-bugs-fix/RELEASE_RUNBOOK.md)
- [Staging Lifecycle Smoke](/Users/av/Documents/pavn/.kiro/specs/critical-bugs-fix/STAGING_LIFECYCLE_SMOKE.md)

## 1. Code Gate

- [ ] `packages/database`, `packages/shifts`, `packages/geofence`, `apps/api`, and `apps/workers` typecheck clean
- [ ] targeted regression tests pass
- [ ] local lifecycle E2E passes

## 2. Config Gate

- [ ] Vercel env is set for `pavn-api`
- [ ] Vercel env is set for `pavn-web`
- [ ] EAS `preview` env is set
- [ ] EAS `production` env is set
- [ ] billing env is either complete or billing is hidden

## 3. Staging Gate

- [ ] staging migration is applied
- [ ] `npm run release:smoke -- --base-url=...` passes
- [ ] `/ready` returns `200`
- [ ] manager/worker smoke flow passes

## 4. Device Gate

- [ ] iPhone passes login, session restore, arrival banner, clock in, clock out
- [ ] Android passes login, session restore, arrival banner, clock in, clock out
- [ ] cancelled shifts stay visible as `cancelled`
- [ ] cross-org conflicts notify the worker but do not block assignment

## 5. Launch Gate

- [ ] Sentry / monitoring is on
- [ ] rollback path is ready
- [ ] no known tenant-isolation or auth regressions remain open

Do not ship if any item above is still open.
