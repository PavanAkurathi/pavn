// Root Vercel entrypoint.
// This file exists only so the top-level vercel.json can point at a stable
// serverless function path while the real API implementation and bundle live in
// apps/api.
export { default } from "./dist/index.js";
