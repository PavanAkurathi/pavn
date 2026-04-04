# API Deployment Guide

This API is a Hono service bundled for deployment from a Bun monorepo. The current production shape is:

- Better Auth executes inside the Hono API at `/api/auth/*`
- the web app may expose `/api/auth/[...all]` as a thin proxy for browser compatibility
- the API is deployed separately and consumes shared workspace packages
- Vercel uses [build.mjs](/Users/av/Documents/pavn/apps/api/build.mjs) to bundle the API into `dist/index.cjs`

## Local Commands

```bash
cd apps/api
bun install
bun run dev
bun run build
bun run start
```

## Required Environment Variables

```bash
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=https://your-web-app.com
```

Notes:

- `BETTER_AUTH_URL` should point to the public auth URL clients use. If the web app proxies `/api/auth/*`, that can stay on the web host even though Hono executes the auth logic.
- `NEXT_PUBLIC_APP_URL` is strongly recommended for readiness checks, invite links, and cross-service URL generation.

## Common Optional Environment Variables

```bash
NEXT_PUBLIC_APP_URL=https://your-web-app.com
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
RESEND_API_KEY=...
EMAIL_FROM=...
SENTRY_DSN=...
STRIPE_SECRET_KEY=...
STRIPE_PRICE_ID_MONTHLY=...
STRIPE_WEBHOOK_SECRET=...
CRON_SECRET=...
BETTER_AUTH_API_KEY=...
BETTER_AUTH_API_URL=https://infra.better-auth.com
BETTER_AUTH_KV_URL=https://kv.better-auth.com
```

## Vercel

This repo already includes the Vercel config in [vercel.json](/Users/av/Documents/pavn/apps/api/vercel.json).

Recommended project settings:

1. Root directory: `apps/api`
2. Framework preset: `Other`
3. Install command: leave blank and use the checked-in config
4. Build command: leave blank and use the checked-in config
5. Node version: `24.x`

How the deploy works:

- Vercel runs `node build.mjs`
- the build aliases workspace packages and bundles them into `dist/index.cjs`
- `api/index.js` serves the bundled output
- `dist/**` is included in the function bundle
- all incoming routes are rewritten to `/api`

## Railway / Render

These work well when you want a more traditional long-running service.

Suggested settings:

1. Root directory: `apps/api`
2. Install command: `cd ../.. && bun install`
3. Build command: `node build.mjs`
4. Start command: `bun ./dist/index.cjs`

## Health and Readiness

Local:

```bash
curl http://localhost:4005/health
curl http://localhost:4005/ready
```

Vercel:

```bash
curl https://your-api-host/health
curl https://your-api-host/ready
curl https://your-api-host/openapi.json
```

## Monorepo Notes

- The API depends on workspace packages from `packages/*`
- deployment must install from the monorepo root, not just `apps/api`
- Vercel bundling is intentionally handled by `build.mjs`; do not replace it with a plain `tsup` or default framework build without re-checking runtime package inclusion
