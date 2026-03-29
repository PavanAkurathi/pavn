# Config

`@repo/config` is the shared policy/configuration package for the monorepo.

Use this package for values and rules that need to stay consistent across web, API, jobs, and mobile.

## Responsibilities

- attendance verification policy enums and defaults
- shift state transition rules
- time rule helpers
- app-wide constants
- deep-link configuration
- shared CORS configuration

## Source Layout

- `src/attendance-policy.ts`
- `src/shift-state.ts`
- `src/time-rules.ts`
- `src/constants.ts`
- `src/deeplinks.ts`
- `src/cors.ts`

## Boundary Rule

Put something here only if it is:

- shared across multiple apps/packages, and
- policy/configuration rather than domain workflow

Do not move business workflows here just because they are reused.
