# Release Runbook

This is the order of operations for a beta or production release.

## 1. Prepare Config

1. Confirm the env values in [ENVIRONMENT_MATRIX.md](/Users/av/Documents/pavn/.kiro/specs/critical-bugs-fix/ENVIRONMENT_MATRIX.md).
2. Confirm EAS setup in [apps/gig-workers/EAS_SETUP.md](/Users/av/Documents/pavn/apps/gig-workers/EAS_SETUP.md).
3. Keep unfinished surfaces hidden unless they are fully enabled.

## 2. Run Local Gates

```bash
cd /Users/av/Documents/pavn
npm run release:preflight
npm run release:lifecycle:local
```

If either command fails, stop here.

## 3. Deploy Staging

1. Deploy `pavn-api`.
2. Deploy `pavn-web`.
3. Apply database migrations to staging.

Then run:

```bash
cd /Users/av/Documents/pavn
npm run release:smoke -- --base-url=https://your-staging-api.example.com
```

Staging is not ready unless `/ready` returns `200`.

## 4. Run Manual Staging Flow

Follow [STAGING_LIFECYCLE_SMOKE.md](/Users/av/Documents/pavn/.kiro/specs/critical-bugs-fix/STAGING_LIFECYCLE_SMOKE.md).

Minimum required checks:

1. manager login and schedule publish
2. worker login and session persistence
3. same-org clock in / clock out
4. cancellation stays visible as `cancelled`
5. cross-org conflict notifies worker without blocking assignment

## 5. Build Mobile

From [apps/gig-workers](/Users/av/Documents/pavn/apps/gig-workers):

```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

Promote to `production` only after staging passes.

## 6. Production Release

1. Freeze to bug-fix-only changes.
2. Deploy `pavn-api` and `pavn-web`.
3. Run production smoke:

```bash
cd /Users/av/Documents/pavn
npm run release:smoke -- --base-url=https://your-production-api.example.com
```

4. Promote the Expo build.

## 7. Watch After Deploy

Watch immediately:

- `/health`
- `/ready`
- OTP/auth failures
- clock in / clock out errors
- push registration and delivery
- tenant-isolation errors

## 8. Rollback

Rollback immediately if auth, tenant isolation, or clock in/out regresses.

1. revert the Vercel deploy
2. pause mobile rollout
3. restore DB only if the migration itself caused damage
4. rerun smoke checks before reopening traffic
