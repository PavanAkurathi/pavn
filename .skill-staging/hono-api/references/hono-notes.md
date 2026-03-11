# Hono Notes

## Hono Principles Relevant Here

Distilled from Hono's developer docs at [hono.dev/llms-full.txt](https://hono.dev/llms-full.txt):

- Hono is a small Web Standards-first framework that runs across Bun, Node, Vercel, Workers, and other runtimes.
- It is well-suited for API servers, middleware-heavy request pipelines, and small route modules.
- Hono works best when the transport layer stays explicit and thin.
- Middleware is a first-class concept; cross-cutting concerns should usually be solved there instead of duplicated in handlers.
- Hono has strong TypeScript ergonomics, especially around route params and validation.

## How To Apply That In This Repo

### 1. Keep Hono at the edge

Only `apps/api` should know about:

- `OpenAPIHono`
- `createRoute`
- `Context`
- route registration and URL structure
- HTTP status code choices
- auth/session extraction from headers/cookies

`packages/*` should not know they are being called from Hono.

### 2. Parse and normalize input in routes

The Hono layer should:

- validate request shape
- derive org/user context
- convert path/query/body/header data into plain inputs
- call package services
- serialize the result to JSON

Package services should:

- enforce domain rules
- do database work
- throw domain-meaningful errors
- avoid request/response objects

### 3. Prefer middleware for repeated policy

If logic is repeated across routes, it probably belongs in middleware or shared app setup:

- tenant context (`x-org-id`)
- auth/session enforcement
- RBAC
- tracing / request IDs
- timeout handling
- shared error handling

### 4. Handle runtime differences deliberately

This repo runs:

- local dev with Bun
- deployed API on Vercel Node runtime

That means some dependencies need explicit runtime wiring. A good example is Neon pooled DB access, which may need a Node WebSocket constructor on Vercel even if Bun works locally.

## OpenAPI Caveat In This Repo

Current repo state matters more than generic Hono advice:

- `@hono/zod-openapi` is installed in the API app
- the repo uses Zod 4 broadly
- the installed `@hono/zod-openapi` version peers on Zod 3

That mismatch can break `/openapi.json` even for minimal schemas.

Practical rule:

- if the task is to fix or extend OpenAPI docs, verify package compatibility first
- do not assume a route-specific schema bug until you have ruled out version mismatch

Also note:

- request param/query/header schemas in `createRoute` need OpenAPI metadata, not only raw Zod validators

## Hono Checklist For Changes

When changing the backend, use this order:

1. Decide whether the change belongs in `apps/api` or `packages/*`.
2. If it is transport-only, keep it in Hono.
3. If it is domain logic, put it in a package and call it from Hono.
4. If a runtime issue appears only on Vercel/Node, check adapter/runtime wiring before touching business logic.
5. If `/openapi.json` breaks, check Zod/OpenAPI compatibility and parameter metadata before rewriting schemas.

