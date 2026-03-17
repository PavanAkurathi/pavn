---
name: hono-api
description: Use when working on a Hono backend or reviewing Hono API structure, especially in repos where Hono owns the transport layer and shared packages hold business logic. Covers route modules, middleware, request validation, runtime adapters, and Hono-specific pitfalls like OpenAPI/version mismatches.
---

# Hono API

## Overview

Use this skill when the task is about the Hono API layer itself: routes, middleware, request/response boundaries, runtime behavior, or API documentation. In this repo, Hono should stay in `apps/api`; `packages/*` should stay pure business logic and must not depend on `Context`, route wiring, or transport details.

## Workflow

1. Confirm the layer boundary first.
   - `apps/api`: Hono app, route registration, auth/session checks, tenant headers, request parsing, response shaping, OpenAPI docs.
   - `packages/*`: business rules, DB access, notifications, geofence logic, reusable schemas/types that are transport-agnostic.
2. Keep route handlers thin.
   - Parse request data at the API boundary.
   - Call package functions with plain values.
   - Return JSON/HTTP semantics only from the Hono layer.
3. Put cross-cutting concerns in middleware or app setup.
   - CORS, auth/session lookup, org scoping, request IDs, timeouts, and error handling belong in `apps/api/src/index.ts` or middleware modules.
4. Preserve Web Standards assumptions.
   - Prefer standard `Request`/`Response`-style behavior and avoid Node-only patterns unless the runtime truly requires them.
5. Treat runtime-specific fixes explicitly.
   - Bun local and Vercel Node can differ. If a dependency needs a Node adapter or WebSocket constructor, document that in the API/runtime layer rather than leaking it into route logic.

## Repo Pattern

For this repo, default to this structure:

- Hono app shell in `apps/api/src/index.ts`
- Route modules in `apps/api/src/routes/*.ts`
- Middleware in `apps/api/src/middleware/*.ts`
- Business logic in `packages/scheduling-timekeeping`, `packages/geofence`, `packages/auth`, `packages/notifications`, `packages/database`

Do not move Hono request handling into packages. Packages should accept plain inputs and return plain data or throw domain errors.

## OpenAPI And Validation

Use `@hono/zod-openapi` only with care.

- Response schemas and request schemas used by `createRoute` must be compatible with the installed `@hono/zod-openapi` and `zod` versions.
- Query/path/header schemas need OpenAPI parameter metadata, not just raw Zod fields.
- If `/openapi.json` fails, check version compatibility before debugging every route by hand.

In this repo specifically, read [references/hono-notes.md](references/hono-notes.md) before changing OpenAPI behavior.

## When To Read References

- Read [references/hono-notes.md](references/hono-notes.md) when touching route architecture, middleware boundaries, runtime adapters, or OpenAPI generation.
