# Environment Matrix

This is the shortest project map for where each variable belongs. Store values in the platform, not in committed files.

## Local Root `.env`

Use [/.env](/Users/av/Documents/pavn/.env) for local development.

Core:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `EXPO_PUBLIC_API_URL`

SMS auth:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `MOCK_SMS`
- `ALLOW_MOCK_OTP_DEBUG` only if you intentionally want mock OTP debug output locally

Worker build config:

- `EXPO_PUBLIC_DUB_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_DUB_DOMAIN`
- `EXPO_PUBLIC_SENTRY_DSN` optional

App / email / ops:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SENTRY_DSN`
- `CRON_SECRET`
- `DUB_API_KEY`

Billing only if enabled:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID_MONTHLY`
- `STRIPE_WEBHOOK_SECRET`

## Vercel: `pavn-api`

Required:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `ALLOWED_ORIGINS`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

Recommended:

- `BETTER_AUTH_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SENTRY_DSN`
- `CRON_SECRET`

Optional:

- `BETTER_AUTH_API_URL`
- `BETTER_AUTH_KV_URL`

Billing only if enabled:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID_MONTHLY`
- `STRIPE_WEBHOOK_SECRET`

## Vercel: `pavn-web`

Required:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`

Recommended:

- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_DUB_DOMAIN`

Usually leave unset unless you intentionally move web auth off same-origin:

- `NEXT_PUBLIC_AUTH_URL`

## EAS: `preview` and `production`

Required:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_DUB_PUBLISHABLE_KEY`

Recommended:

- `EXPO_PUBLIC_DUB_DOMAIN`
- `EXPO_PUBLIC_SENTRY_DSN`

Only if services are split:

- `EXPO_PUBLIC_AUTH_API_URL`
- `EXPO_PUBLIC_SHIFTS_API_URL`
- `EXPO_PUBLIC_GEOFENCE_API_URL`

## Current Host Mapping

If you keep the current Vercel setup:

- web app: `https://pavn-web.vercel.app`
- API: `https://pavn-api.vercel.app`

That means the common values are:

- `BETTER_AUTH_URL=https://pavn-api.vercel.app`
- `NEXT_PUBLIC_APP_URL=https://pavn-web.vercel.app`
- `NEXT_PUBLIC_API_URL=https://pavn-api.vercel.app`
- `EXPO_PUBLIC_API_URL=https://pavn-api.vercel.app`

## After Any Change

1. Restart the affected app.
2. Run:

```bash
cd /Users/av/Documents/pavn
npm run check-env
```

3. Rebuild the worker app if an `EXPO_PUBLIC_*` value changed.
