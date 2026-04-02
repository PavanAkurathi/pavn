# Beta Release Checklist

This checklist is the current release gate for the Workers Hive beta.

Use it before tagging a beta or inviting a wider test group.

## Current Automated Coverage

What we already have:

- `apps/web`
  - TypeScript check via `npm run check-types --workspace=apps/web`
- `apps/api`
  - TypeScript check via `npm run typecheck --workspace=apps/api`
  - Vercel bundle build via `node apps/api/build.mjs`
- `apps/gig-workers`
  - TypeScript check via `npx tsc -p apps/gig-workers/tsconfig.json --noEmit`
  - very light Jest smoke test in [App.test.tsx](/Users/av/Documents/pavn/apps/gig-workers/__tests__/App.test.tsx)
  - one Maestro login flow in [login.yaml](/Users/av/Documents/pavn/apps/gig-workers/.maestro/login.yaml)
- `packages/e2e`
  - Playwright API lifecycle coverage in [lifecycle.spec.ts](/Users/av/Documents/pavn/packages/e2e/tests/api/lifecycle.spec.ts)
  - web signup and business invite coverage in:
    - [signup-auth-flow.spec.ts](/Users/av/Documents/pavn/packages/e2e/tests/web/signup-auth-flow.spec.ts)
    - [business-invite-activation.spec.ts](/Users/av/Documents/pavn/packages/e2e/tests/web/business-invite-activation.spec.ts)

What is still weak:

- mobile UI regression coverage
- mobile deep-link invite verification on a real device
- mobile multi-org worker interaction coverage
- billing UI/browser-path automation

So the repo does have testing, but the mobile side is still mostly:

- type safety
- API-backed auth lifecycle verification
- manual QA

## Release Commands

Run these first:

```bash
npm run check-types --workspace=apps/web
npm run typecheck --workspace=apps/api
npx tsc -p apps/gig-workers/tsconfig.json --noEmit
node apps/api/build.mjs
```

If local API validation is needed:

```bash
cd apps/api
bun --env-file=../../.env run dev
```

Then in another shell:

```bash
cd packages/e2e
API_URL=http://127.0.0.1:4005 PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --project=api tests/api/lifecycle.spec.ts --workers=1
```

Live deployment health:

```bash
curl -i https://pavn-api.vercel.app/health
curl -i https://pavn-web.vercel.app/api/health
```

Expected result:

- both health endpoints return `200`
- all typechecks pass
- API lifecycle test passes

## Manual QA: Business Side

### 1. Business owner signup

- Open web signup.
- Create a new business owner account.
- Verify email OTP / verification flow works.
- Confirm organization is created automatically.
- Confirm first sign-in lands on onboarding.
- Confirm incomplete admin is redirected into onboarding.

Pass condition:

- owner can reach dashboard only after onboarding rules are satisfied

### 2. Business invite activation

- Invite a brand-new manager/admin from the business team UI.
- Open the invite link.
- Confirm the user reaches the activation flow, not just generic login.
- Complete password/email verification path.
- Confirm membership is created only after acceptance.

Pass condition:

- no shadow user confusion
- invite remains pending until accepted

### 3. Existing business user invite acceptance

- Invite an email that already has an account.
- Confirm the invite path leads to sign-in and acceptance.
- Confirm the user lands in the invited organization after acceptance.

Pass condition:

- existing accounts can accept invites without duplicate-user behavior

## Manual QA: Worker Side

### 4. Worker access gate

- Try a worker phone number not added to any workforce.
- Confirm mobile login blocks access cleanly.
- Add or import that worker into the roster with a phone number.
- Retry login.

Pass condition:

- no public self-signup
- workforce presence is the real gate

### 5. Worker invite link flow

- Send/open a worker invite link on a device.
- Confirm the screen explains the link is only a shortcut.
- Enter the invited phone number.
- Complete OTP verification.

Pass condition:

- invite link does not act as the source of truth
- phone/workforce eligibility still controls access

### 6. Returning worker login

- Log out a worker who already has access.
- Sign back in with the same phone number.
- Confirm returning-account messaging appears.

Pass condition:

- worker can return through OTP without losing org access

## Manual QA: Multi-Org Worker

This is a high-priority beta scenario.

### 7. Multi-org schedule and detail flow

- Use a worker who belongs to at least two organizations.
- Open shifts from org A and org B from the main shifts screen.
- Confirm each shift detail page loads correctly.

Pass condition:

- shift detail does not fail because of the wrong active org

### 8. Multi-org clock in / clock out

- For a worker with shifts in multiple orgs, open a shift from org A and clock in/out.
- Repeat for org B.

Pass condition:

- geofence actions respect the shift’s org, not stale global org state

### 9. Multi-org adjustment request

- Open a completed shift from org A and submit an adjustment request.
- Repeat for org B.

Pass condition:

- adjustment requests reach the correct organization context

## Manual QA: Worker Product Surfaces

### 10. Shift detail

- Open upcoming shift
- Open in-progress shift
- Open completed shift

Confirm:

- location panel renders correctly
- clock-in state and clock-out state look correct
- late/missing-clock flags render correctly

### 11. Availability

- Open weekly availability
- Navigate previous/next week
- Block a day with no shift
- Open a scheduled day and drill into shift detail

Pass condition:

- no broken navigation
- blocked day save succeeds

### 12. Notifications / profile / settings

- Open profile
- Open settings
- Open notifications screen

Pass condition:

- no crash
- no auth/session redirect loop

## Billing / Settings Sanity

### 13. Billing sanity

- Open business billing/settings
- Confirm page loads
- Confirm current subscription state renders
- Confirm customer portal / checkout action path does not immediately error

Pass condition:

- billing UI is reachable and wired

## Go / No-Go Rule

Ship beta only if:

- automated checks all pass
- business signup works
- business invite activation works
- worker workforce-gated OTP works
- multi-org worker detail + clock in/out + adjustment flows work
- live web/API health endpoints return `200`

Do not ship beta if:

- worker can sign in without workforce access
- invited business users bypass acceptance flow
- multi-org worker actions hit the wrong org
- billing/settings hard-crash

## Current Readiness Note

At the time this checklist was added:

- web typecheck passed
- API typecheck passed
- mobile TypeScript passed
- API bundle build passed
- live web/API health passed
- API lifecycle Playwright passed

Remaining beta risk is mostly in manual mobile QA and real delivery services:

- mobile device/runtime behavior
- email delivery/domain verification
- worker invite deep-link behavior on device
