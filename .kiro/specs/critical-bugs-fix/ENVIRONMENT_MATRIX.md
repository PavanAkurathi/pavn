# Environment Matrix

This matrix lists launch-critical variable names only. Do not commit actual values to the repo.

## Rules

- Store secrets in platform secret managers or your local shell, not in committed files.
- `EXPO_PUBLIC_*` values are public app config, but they should still be changed by you through EAS/build env settings rather than hardcoded in source.
- Use `npm run check-env` to verify presence without printing values.

## Local

Use a private, uncommitted env file or shell session.

Required for local API/web auth flow:
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`

Required for real SMS auth testing:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

Worker app:
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_DUB_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_DUB_DOMAIN`
- `EXPO_PUBLIC_AUTH_API_URL` if auth is split from the main API URL
- `EXPO_PUBLIC_SHIFTS_API_URL` if shifts are split from the main API URL
- `EXPO_PUBLIC_GEOFENCE_API_URL` if geofence is split from the main API URL

Recommended:
- `SENTRY_DSN`
- `EXPO_PUBLIC_SENTRY_DSN`
- `CRON_SECRET`
- `DUB_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `BETTER_AUTH_API_KEY`
- `BETTER_AUTH_API_URL`
- `BETTER_AUTH_KV_URL`

Launch-optional unless billing is enabled:
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID_MONTHLY`
- `STRIPE_WEBHOOK_SECRET`

## Staging

Set these in the staging hosting environment and EAS staging profile.

Required runtime:
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

Required worker build config:
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_DUB_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_DUB_DOMAIN`
- `EXPO_PUBLIC_AUTH_API_URL` if auth is split from the main API URL
- `EXPO_PUBLIC_SHIFTS_API_URL` if shifts are split from the main API URL
- `EXPO_PUBLIC_GEOFENCE_API_URL` if geofence is split from the main API URL

Recommended:
- `SENTRY_DSN`
- `EXPO_PUBLIC_SENTRY_DSN`
- `CRON_SECRET`
- `DUB_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `BETTER_AUTH_API_KEY`
- `BETTER_AUTH_API_URL`
- `BETTER_AUTH_KV_URL`

Launch-optional unless billing is enabled:
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID_MONTHLY`
- `STRIPE_WEBHOOK_SECRET`

## Production

Set these only in the production secret manager / build system.

Required runtime:
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

Required worker build config:
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_DUB_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_DUB_DOMAIN`
- `EXPO_PUBLIC_AUTH_API_URL` if auth is split from the main API URL
- `EXPO_PUBLIC_SHIFTS_API_URL` if shifts are split from the main API URL
- `EXPO_PUBLIC_GEOFENCE_API_URL` if geofence is split from the main API URL

Recommended:
- `SENTRY_DSN`
- `EXPO_PUBLIC_SENTRY_DSN`
- `CRON_SECRET`
- `DUB_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `BETTER_AUTH_API_KEY`
- `BETTER_AUTH_API_URL`
- `BETTER_AUTH_KV_URL`

Required only if billing is enabled for launch:
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID_MONTHLY`
- `STRIPE_WEBHOOK_SECRET`

## Where To Change Them

- Local API/web: your private `.env` or shell export, never committed.
- Hosted API/web: your hosting provider's secret/env settings.
- Expo worker app: EAS secrets or build-profile env settings.
- After any change, restart the affected app and rerun `npm run check-env`.
