# Observability

`@repo/observability` owns shared logging, tracing, timeout, and error primitives.

## Responsibilities

- app-level error types
- request timeout helpers
- audit/event logging helpers
- shared Sentry/logging setup used by apps and packages

## Source Layout

- `src/errors.ts`
- `src/timeout.ts`
- `src/audit.ts`
- `src/index.ts`

## Boundary Rule

This package should provide observability primitives, not business decisions.
