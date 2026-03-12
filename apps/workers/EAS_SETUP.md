# EAS Setup

Run all Expo/EAS commands from [apps/workers](/Users/av/Documents/pavn/apps/workers), not the repo root.

## 1. Log In

```bash
cd /Users/av/Documents/pavn/apps/workers
eas login
```

## 2. Add EAS Variables

Set these in both `preview` and `production`:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_DUB_PUBLISHABLE_KEY`

Recommended:

- `EXPO_PUBLIC_DUB_DOMAIN`
- `EXPO_PUBLIC_SENTRY_DSN`

Only add these if you intentionally split services:

- `EXPO_PUBLIC_AUTH_API_URL`
- `EXPO_PUBLIC_SHIFTS_API_URL`
- `EXPO_PUBLIC_GEOFENCE_API_URL`

Example:

```bash
cd /Users/av/Documents/pavn/apps/workers
eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value "https://pavn-api.vercel.app"
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value "https://pavn-api.vercel.app"
```

## 3. Build Preview

```bash
cd /Users/av/Documents/pavn/apps/workers
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

Use preview builds for real device checks. Expo Go is fine for basic auth/navigation testing, but not for full push notification behavior.

## 4. Build Production

Only do this after staging is healthy and the manual smoke flow passes.

```bash
cd /Users/av/Documents/pavn/apps/workers
eas build --platform ios --profile production
eas build --platform android --profile production
```

## 5. What Not To Put In EAS

Do not put backend secrets in EAS:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `TWILIO_*`
- `RESEND_API_KEY`
- Stripe secret vars

Those stay in Vercel for `pavn-api` / `pavn-web`.
