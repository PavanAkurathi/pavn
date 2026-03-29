# Notifications

`@repo/notifications` owns notification delivery and scheduling primitives.

## Responsibilities

- Expo push dispatch
- notification scheduling
- canonical queue dispatch helpers
- shared notification types

## Source Layout

- `src/services/expo-push.ts`
- `src/services/scheduler.ts`
- `src/services/dispatch.ts`
- `src/types.ts`

## Boundaries

This package should contain:

- how notifications are queued, scheduled, and delivered
- the single source of truth for queued notification dispatch

This package should not contain:

- business decisions about when a shift should be published
- attendance verification logic
- UI messaging surfaces
- worker-specific process wrappers
