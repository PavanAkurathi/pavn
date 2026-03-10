# Staging Lifecycle Smoke

This smoke flow is for a real scheduling beta on staging. It separates what is already automated locally from what must still be validated by a human using the manager web app and the Expo worker app.

## Automated Local Gate

Run this before you touch staging:

```bash
cd /Users/av/Documents/pavn
npm run release:preflight
```

This now covers:
- env presence audit
- typechecks for `database`, `shifts`, `geofence`, `api`, `workers`, and `e2e`
- targeted regression tests
- the manager/worker lifecycle API E2E in [lifecycle.spec.ts](/Users/av/Documents/pavn/packages/e2e/tests/api/lifecycle.spec.ts)

If you only want the lifecycle E2E:

```bash
cd /Users/av/Documents/pavn
npm run release:lifecycle:local
```

## Staging Deploy Gate

After the staging deploy is live:

```bash
cd /Users/av/Documents/pavn
npm run release:smoke -- --base-url=https://your-staging-api.example.com
```

Pass criteria:
- `/health` returns healthy
- `/ready` returns `200`
- `/openapi.json` is reachable

## Accounts And Data To Prepare

Create or reuse:
- one manager account in staging
- one worker account in staging
- one organization with a valid location
- one second organization if you want to validate cross-org conflict notifications

Make sure the worker can log into the Expo app and the manager can log into the web app.

## Manager And Worker Lifecycle

### 1. Registration And Login

Manager:
- register a new organization or log into an existing manager account
- confirm the manager lands in the business web app and can access scheduling

Worker:
- join through a real invite link or log into an invited worker account
- confirm the worker lands on the `Shifts` tab
- fully close and reopen the app
- confirm the session persists and the worker stays signed in

### 2. Publish And Staffing

Manager:
- create or verify a same-org location
- publish a new shift for today with one worker slot
- assign the worker to the shift

Pass criteria:
- the shift is visible in the manager schedule
- the worker sees the shift in the Expo app
- the shift is not deleted or hidden unexpectedly if later cancelled

### 3. Tenant Boundary Checks

Manager:
- attempt to publish using a location id from another organization

Pass criteria:
- the request is rejected

Optional cross-org conflict validation:
- create an overlapping shift for the same worker in a second organization
- assign the worker in both orgs

Pass criteria:
- the assignment is not blocked purely because another org has a conflict
- the worker receives an in-app conflict notification
- Org A manager cannot see Org B shift details
- Org B manager cannot see Org A shift details

### 4. Arrival And Clock-In

Worker:
- travel into the active shift geofence
- keep the app foregrounded once and backgrounded once

Pass criteria:
- the worker gets the in-app arrival notification/banner
- no SMS is sent for arrival reminders

Then:
- attempt clock-in off-site and confirm it fails
- attempt clock-in on-site with current GPS and confirm it succeeds

### 5. Clock-Out And Approval

Worker:
- clock out on-site

Manager:
- open the shift timesheet view
- verify the recorded timesheet exists
- approve the shift

Pass criteria:
- the worker sees the shift move into history
- the final shift status is visible as `approved`

### 6. Cancellation Path

Manager:
- publish a second test shift
- cancel it before start

Pass criteria:
- the shift remains visible as `cancelled` on the manager side
- the worker sees the same shift as `cancelled`
- the worker receives a cancellation notification
- the shift is not hard-deleted

### 7. Exceptions

Manager:
- mark a worker `no_show` on a same-org shift
- attempt the same action across org boundaries if you have two orgs
- apply a manual timesheet edit

Pass criteria:
- same-org `no_show` works
- cross-org `no_show` is rejected
- manual edit succeeds only within the active org

Worker:
- submit a correction request for a finished shift

Manager:
- review and resolve the correction

Pass criteria:
- correction submission works
- manager review works

## Mobile-Specific Checks

iPhone:
- OTP login
- session persistence after restart
- push permission prompt
- arrival notification/banner
- on-site clock-in and clock-out

Android:
- OTP login
- session persistence after restart
- background location permission
- foreground service behavior if applicable
- arrival notification/banner
- on-site clock-in and clock-out

## Suggested Order

1. `npm run release:preflight`
2. deploy staging API and web
3. `npm run release:smoke -- --base-url=https://your-staging-api.example.com`
4. manager web manual flow
5. worker Expo manual flow on iPhone
6. worker Expo manual flow on Android

Do not call the beta ready until all six steps pass.
