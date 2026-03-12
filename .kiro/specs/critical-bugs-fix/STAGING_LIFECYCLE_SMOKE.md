# Staging Lifecycle Smoke

Run this after staging deploy and after `npm run release:smoke -- --base-url=...` is green.

## Accounts To Prepare

- one manager account
- one worker account
- one org with a valid location
- optional second org for cross-org conflict testing

## Manager + Worker Flow

### 1. Login

Manager:

- log into the web app
- confirm schedule pages load

Worker:

- log into the Expo app with OTP
- close and reopen the app
- confirm the session persists

### 2. Publish

Manager:

- create or reuse a same-org location
- publish a shift for today
- assign the worker

Pass:

- manager sees the shift
- worker sees the shift

### 3. Tenant Boundary

Manager:

- try publishing with a foreign-org location id

Pass:

- request is rejected

Optional:

- assign the same worker to overlapping shifts in two orgs

Pass:

- assignment is allowed
- worker gets conflict notification
- managers do not see each other’s shift detail

### 4. Arrival + Clock In

Worker:

- enter the venue geofence
- keep app foregrounded once
- keep app backgrounded once

Pass:

- arrival banner / notification appears in app
- no arrival SMS is sent

Then:

- confirm off-site clock-in fails
- confirm on-site clock-in succeeds

### 5. Clock Out + Approval

Worker:

- clock out on-site

Manager:

- open timesheet
- approve shift

Pass:

- worker sees shift in history
- final shift status is `approved`

### 6. Cancellation

Manager:

- publish a second shift
- cancel it before start

Pass:

- manager sees `cancelled`
- worker sees `cancelled`
- worker gets cancellation notification
- shift is not deleted

### 7. Exceptions

Manager:

- mark same-org `no_show`
- attempt cross-org `no_show`
- apply a manual timesheet edit

Pass:

- same-org action works
- cross-org action is rejected
- manual edit stays same-org only

Worker:

- submit a correction request

Manager:

- review it

Pass:

- correction flow works end to end

## Devices

Run the worker flow on:

- iPhone
- Android

Do not call staging ready until both pass.
