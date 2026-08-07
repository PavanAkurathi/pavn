#!/usr/bin/env node
/**
 * Loads the bundled API the way Vercel does and drives a request through it.
 *
 * `apps/api/build.mjs` succeeding proves only that esbuild wrote a file. It
 * does not prove the file can be *loaded*: an ESM dependency calling
 * `createRequire(import.meta.url)` bundles to `createRequire(undefined)` and
 * throws before a single route runs, so every request returns
 * FUNCTION_INVOCATION_FAILED while lint, types, tests and build stay green.
 * That shipped to production once. This check is the gate that catches it.
 *
 * The bundle is a Vercel function (it exports GET/POST/... handlers), not a
 * server that listens, so this drives `app.fetch` rather than opening a port.
 */

import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { loadRootEnv } from "./load-root-env.mjs";

// The bundle validates its env at module load, so it needs the same vars a real
// boot gets. Inherited values win, so CI's explicit env is left alone.
loadRootEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(__dirname, "..", "apps/api/dist/index.cjs");

if (!existsSync(bundlePath)) {
    console.error(`Bundle not found at ${bundlePath}. Run "node apps/api/build.mjs" first.`);
    process.exit(1);
}

// Never let the smoke check take the production code path (it throws on any
// unset required env var, which is exactly what CI does not have).
if (process.env.NODE_ENV === "production") {
    process.env.NODE_ENV = "test";
}

const require = createRequire(import.meta.url);

let mod;
try {
    mod = require(bundlePath);
} catch (error) {
    console.error("✖ API bundle threw while loading. It cannot serve any request.");
    console.error(error);
    process.exit(1);
}

const fetchHandler = mod?.default?.fetch ?? mod?.app?.fetch;
if (typeof fetchHandler !== "function") {
    console.error("✖ API bundle loaded but exposes no fetch handler (expected default.fetch or app.fetch).");
    console.error(`  exports: ${Object.keys(mod ?? {}).join(", ") || "(none)"}`);
    process.exit(1);
}

for (const method of ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]) {
    if (typeof mod[method] !== "function") {
        console.error(`✖ API bundle is missing the "${method}" export Vercel routes to.`);
        process.exit(1);
    }
}

const response = await fetchHandler(new Request("http://127.0.0.1/health"));
const body = await response.json().catch(() => null);

if (!response.ok || body?.status !== "ok") {
    console.error(`✖ /health returned ${response.status} ${JSON.stringify(body)}`);
    process.exit(1);
}

console.log("API bundle loads, exports Vercel handlers, and answers /health: OK");
process.exit(0);
