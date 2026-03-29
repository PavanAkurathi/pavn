# `@repo/billing`

`@repo/billing` owns organization-scoped subscription and Stripe billing logic.

This package is the shared billing domain layer used by:

- the web app's checkout and customer portal actions
- the Stripe webhook sync route
- read-only billing views exposed through the API

It should own:

- Stripe client setup for org subscriptions
- org subscription reads and invoice history
- checkout / portal session creation helpers
- webhook synchronization helpers
- billing response schemas shared across adapters

It should not own:

- session lookup
- route-level auth / RBAC
- UI concerns
- general scheduling or onboarding logic
