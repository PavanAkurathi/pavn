# Utils

`@repo/utils` holds small generic helpers with no clear domain ownership.

## Current Responsibilities

- phone-number helper utilities in `src/phone.ts`

## Boundary Rule

Keep this package small.

If a helper belongs to a real domain, move it into that domain package instead of growing `utils` into a dumping ground.
