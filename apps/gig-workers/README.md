# Gig Workers App

Expo app for gig workers.

## Mobile Design System

The official mobile design system is now:

- `HeroUI Native` for components
- `Uniwind` for styling and tokens
- Workers Hive brand tokens mapped in [global.css](/Users/av/Documents/pavn/apps/gig-workers/global.css)

Migration rules:

- every user-facing mobile surface should use `HeroUI Native` primitives or local wrappers built on top of them
- do not introduce a second custom UI language with one-off `StyleSheet` form/card/button implementations
- use `className` with Uniwind for layout and spacing
- keep app-specific wrappers in [components/ui](/Users/av/Documents/pavn/apps/gig-workers/components/ui)
- shared surfaces like shift cards, settings rows, headers, and empty states should live in reusable HeroUI-based components instead of being reimplemented inline per screen
- only fall back to raw React Native primitives when the behavior is platform-native or HeroUI does not provide an equivalent building block cleanly

The first canonical migrated screen is [app/(auth)/login.tsx](/Users/av/Documents/pavn/apps/gig-workers/app/%28auth%29/login.tsx).

## Run Locally

From the repo root:

```bash
bun install
```

Start the API/web stack in another terminal, then run Expo:

```bash
cd /Users/av/Documents/pavn/apps/gig-workers
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

- [app.json](/Users/av/Documents/pavn/apps/gig-workers/app.json)
- [eas.json](/Users/av/Documents/pavn/apps/gig-workers/eas.json)
- [lib/config.ts](/Users/av/Documents/pavn/apps/gig-workers/lib/config.ts)
- [EAS_SETUP.md](/Users/av/Documents/pavn/apps/gig-workers/EAS_SETUP.md)
