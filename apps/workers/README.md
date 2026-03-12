# Workers App

Expo app for gig workers.

## Run Locally

From the repo root:

```bash
bun install
```

Start the API/web stack in another terminal, then run Expo:

```bash
cd /Users/av/Documents/pavn/apps/workers
bun run start
```

## Local Requirements

- root [/.env](/Users/av/Documents/pavn/.env) must be set
- `EXPO_PUBLIC_API_URL` must point to your reachable API
- for a real phone on local Wi-Fi, use your LAN IP instead of `localhost`

## Expo Go vs Preview Build

Expo Go is fine for:

- auth flow
- navigation
- API-backed screens

Use a preview/dev build for:

- push notifications
- full native notification behavior
- final device validation

## Important Files

- [app.json](/Users/av/Documents/pavn/apps/workers/app.json)
- [eas.json](/Users/av/Documents/pavn/apps/workers/eas.json)
- [lib/config.ts](/Users/av/Documents/pavn/apps/workers/lib/config.ts)
- [EAS_SETUP.md](/Users/av/Documents/pavn/apps/workers/EAS_SETUP.md)
