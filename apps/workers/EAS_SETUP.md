# EAS Setup

This app already has an Expo project id and build profiles. The missing piece is consistent EAS environments so builds use your variables, not local machine state.

## Build Profiles

The worker app uses these profiles in [eas.json](/Users/av/Documents/pavn/apps/workers/eas.json):

- `development`: development client builds, EAS environment `development`, channel `development`
- `preview`: internal distribution builds, EAS environment `preview`, channel `preview`
- `production`: store/release builds, EAS environment `production`, channel `production`

## What To Put In EAS

Set these yourself in EAS for the correct environment. Do not commit them to the repo.

Required public config:
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_DUB_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_DUB_DOMAIN`

Optional only if you intentionally split services:
- `EXPO_PUBLIC_AUTH_API_URL`
- `EXPO_PUBLIC_SHIFTS_API_URL`
- `EXPO_PUBLIC_GEOFENCE_API_URL`

Recommended mobile observability:
- `EXPO_PUBLIC_SENTRY_DSN`

These values are injected during build. `EXPO_PUBLIC_*` is visible to the app binary, so treat it as configuration, not as a secret.

## How To Add Variables Without Exposing Them Here

Use either the Expo dashboard or the EAS CLI on your machine.

Examples:

```bash
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value "https://api.example.com"
eas env:create --environment production --name EXPO_PUBLIC_DUB_PUBLISHABLE_KEY --value "pk_..."
eas env:create --environment production --name EXPO_PUBLIC_DUB_DOMAIN --value "links.workershive.com"
eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --value "https://..."
```

Repeat for `preview` with staging values.

## Recommended Flow

1. Set `preview` env values in EAS.
2. Build a preview app:

```bash
cd apps/workers
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

3. Validate login persistence, push, geofence arrival banners, and clock in/out on real devices.
4. Set `production` env values in EAS.
5. Build production binaries only after staging `/ready` is healthy.

## Notes

- Local `.env` values are not enough for EAS cloud builds unless you explicitly create matching EAS environment variables.
- If you want to use local credentials for a simulator/dev-client build, keep doing that locally. For preview/production, prefer EAS-managed environment variables.
