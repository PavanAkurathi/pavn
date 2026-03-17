import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const packageRoot = new URL("..", import.meta.url).pathname;
const includeDirs = ["tests", "src"];

function collectTests(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTests(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

const testFiles = includeDirs
  .map((dir) => join(packageRoot, dir))
  .flatMap((dir) => {
    try {
      return collectTests(dir);
    } catch {
      return [];
    }
  })
  .filter((file) => process.env.RUN_EXPLORATION_DB_TESTS === "true" || !file.includes("/exploration-"))
  .sort();

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
