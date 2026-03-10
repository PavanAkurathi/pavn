import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRootEnv } from "./load-root-env.mjs";

loadRootEnv();

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a free port")));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(String(port));
      });
    });
  });
}

async function isHealthy(baseUrl) {
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(baseUrl, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    if (await isHealthy(baseUrl)) {
      return true;
    }
    await delay(1000);
  }

  return false;
}

let apiServer;
const explicitApiUrl = process.env.API_URL;
const port = explicitApiUrl
  ? (() => {
      try {
        return new URL(explicitApiUrl).port || "4005";
      } catch {
        return "4005";
      }
    })()
  : await findFreePort();
const baseUrl = explicitApiUrl || `http://127.0.0.1:${port}`;

if (!explicitApiUrl || !(await isHealthy(baseUrl))) {
  apiServer = spawn("bun", ["run", "dev"], {
    cwd: path.join(repoRoot, "apps/api"),
    env: { ...process.env, PORT: port },
    stdio: "inherit",
  });

  const ready = await waitForHealth(baseUrl);
  if (!ready) {
    apiServer.kill("SIGTERM");
    console.error(`API server did not become healthy at ${baseUrl}`);
    process.exit(1);
  }
}

const result = spawnSync("npm", ["run", "test:api:lifecycle", "--workspace=packages/e2e"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    API_URL: baseUrl,
    PLAYWRIGHT_SKIP_WEBSERVER: "1",
  },
  stdio: "inherit",
});

if (apiServer) {
  apiServer.kill("SIGTERM");
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
