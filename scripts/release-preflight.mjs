import { spawnSync } from "node:child_process";
import { loadRootEnv } from "./load-root-env.mjs";

loadRootEnv();

const steps = [
  {
    label: "Launch env audit",
    command: ["bun", "run", "check-env"],
  },
  {
    // One turbo run covers every workspace, so this cannot silently skip a
    // package the way the old per-workspace list did. The task is `check-types`
    // — the previous `typecheck` name no longer exists anywhere and made every
    // one of these steps fail on a missing script.
    label: "Typecheck all workspaces",
    command: ["bun", "run", "check-types"],
  },
  {
    label: "Typecheck tests/e2e",
    command: ["bunx", "tsc", "--noEmit", "-p", "tests/e2e/tsconfig.json"],
  },
  {
    label: "Targeted regression tests",
    command: [
      "bun",
      "test",
      "packages/scheduling-timekeeping/tests/update-timesheet.test.ts",
      "packages/scheduling-timekeeping/tests/worker-all-shifts.test.ts",
      "packages/scheduling-timekeeping/tests/publish.test.ts",
      "packages/scheduling-timekeeping/tests/cross-org-conflict-notifications.test.ts",
      "apps/api/src/routes/shifts.test.ts",
    ],
  },
  {
    // Builds the Vercel bundle and loads it. Typechecks and tests run against
    // source, so neither can see a bundle that throws on require() — which is
    // how a dead production API passed every other gate here.
    label: "API bundle loads",
    command: ["bun", "run", "verify:api-bundle"],
  },
  {
    label: "Manager/worker lifecycle E2E",
    command: ["bun", "run", "release:lifecycle:local"],
  },
];

for (const step of steps) {
  console.log(`\n==> ${step.label}`);

  const result = spawnSync(step.command[0], step.command.slice(1), {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nRelease preflight passed.");
