# API Shim

This folder is a deployment shim for Vercel.

- The real API source lives in `/Users/av/Documents/pavn/apps/api`.
- The root-level `/Users/av/Documents/pavn/vercel.json` points to `api/index.ts`.
- `api/index.ts` re-exports the compiled API bundle so Vercel has a stable
  function entrypoint at the repo root.

This folder is not a second backend application.
