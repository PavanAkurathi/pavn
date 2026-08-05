/**
 * Runs a workspace's Bun tests one file per process.
 *
 * Bun's `mock.module()` registers globally and is never torn down between test
 * files sharing a process, so a module stubbed in one file stays stubbed for
 * every file that runs after it. That silently inverted real assertions here
 * (packages/geofence's anti-spoofing tests stub @repo/config, which made
 * geofence-logic.test.ts see isEarly/isLate as always false). Isolating each
 * file is the only reliable fix short of banning module mocks.
 *
 * Run from a package root: `node ../../scripts/run-package-tests.mjs`
 *
 * Tests named `exploration-*` or `preservation-*` hit a live database and are
 * skipped unless RUN_DB_TESTS=true (RUN_EXPLORATION_DB_TESTS is honoured as the
 * older spelling). They need DATABASE_URL and will fail without it.
 */
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const packageRoot = process.cwd();
const IGNORED_DIRS = new Set([
    "node_modules",
    "dist",
    "build",
    ".next",
    ".expo",
    ".turbo",
    ".git",
    "coverage",
]);

function collectTests(dir) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }

    const files = [];
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name)) continue;
            files.push(...collectTests(fullPath));
            continue;
        }
        if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
}

const runDbTests =
    process.env.RUN_DB_TESTS === "true" ||
    process.env.RUN_EXPLORATION_DB_TESTS === "true";

const isDbTest = (file) =>
    /\/(exploration|preservation)-/.test(file);

const allTests = collectTests(packageRoot).sort();
const testFiles = allTests.filter((file) => runDbTests || !isDbTest(file));

const skipped = allTests.length - testFiles.length;
if (skipped > 0) {
    console.log(
        `[tests] Skipping ${skipped} database-backed test file(s). Set RUN_DB_TESTS=true with DATABASE_URL to include them.`,
    );
}

if (testFiles.length === 0) {
    console.log("[tests] No test files found.");
    process.exit(0);
}

const failures = [];

for (const file of testFiles) {
    const displayPath = relative(packageRoot, file);
    console.log(`\n[tests] Running ${displayPath}`);

    const result = spawnSync("bun", ["test", file], {
        cwd: packageRoot,
        stdio: "inherit",
        env: process.env,
    });

    if (result.status !== 0) {
        failures.push(displayPath);
    }
}

if (failures.length > 0) {
    console.error(`\n[tests] Failed files (${failures.length}):`);
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exit(1);
}

console.log(`\n[tests] All ${testFiles.length} files passed.`);
