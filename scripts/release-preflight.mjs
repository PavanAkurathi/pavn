import { spawnSync } from "node:child_process";
import { loadRootEnv } from "./load-root-env.mjs";

loadRootEnv();

const steps = [
  {
    label: "Launch env audit",
    command: ["npm", "run", "check-env"],
  },
  {
    label: "Typecheck packages/database",
    command: ["npm", "run", "typecheck", "--workspace=packages/database"],
  },
  {
    label: "Typecheck packages/scheduling-timekeeping",
    command: ["npm", "run", "typecheck", "--workspace=packages/scheduling-timekeeping"],
  },
  {
    label: "Typecheck packages/geofence",
    command: ["npm", "run", "typecheck", "--workspace=packages/geofence"],
  },
  {
    label: "Typecheck apps/api",
    command: ["npm", "run", "typecheck", "--workspace=apps/api"],
  },
  {
    label: "Typecheck apps/gig-workers",
    command: ["npx", "tsc", "--noEmit", "-p", "apps/gig-workers/tsconfig.json"],
  },
  {
    label: "Typecheck packages/e2e",
    command: ["npx", "tsc", "--noEmit", "-p", "packages/e2e/tsconfig.json"],
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
    label: "Manager/worker lifecycle E2E",
    command: ["npm", "run", "release:lifecycle:local"],
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
