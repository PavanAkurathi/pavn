# UI

`@repo/ui` is the shared web design-system package.

It contains the shadcn-based component layer, supporting hooks, and shared styles used by the Next.js web app.

## Responsibilities

- web UI primitives under `src/components/ui`
- shared hooks
- shared utility functions for class merging and design-system support
- global styles for the web design system

## Boundary Rule

This package should stay presentation-focused.

Do not move business logic here just because a component needs data.
