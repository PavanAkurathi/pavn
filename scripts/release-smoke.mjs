const args = process.argv.slice(2);

function readArg(name) {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = args.indexOf(name);
  if (index >= 0) {
    return args[index + 1];
  }

  return undefined;
}

const rawBaseUrl = readArg("--base-url") || process.env.RELEASE_BASE_URL;
const baseUrl = rawBaseUrl?.replace(/\/+$/, "");

if (!baseUrl) {
  console.error("Missing base URL. Use --base-url=https://your-api.example.com or set RELEASE_BASE_URL.");
  process.exit(1);
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json().catch(() => null);
  return { response, body };
}

const checks = [
  {
    label: "Health",
    path: "/health",
    validate({ response, body }) {
      return response.ok && body?.status === "ok";
    },
  },
  {
    label: "Readiness",
    path: "/ready",
    validate({ response, body }) {
      return response.status === 200 && body?.status === "ready";
    },
  },
  {
    label: "OpenAPI",
    path: "/openapi.json",
    validate({ response, body }) {
      return response.ok && typeof body?.openapi === "string";
    },
  },
];

for (const check of checks) {
  const result = await getJson(check.path);
  const ok = check.validate(result);

  if (!ok) {
    console.error(`${check.label} check failed at ${check.path}`);
    if (check.path === "/ready" && result.body) {
      console.error(JSON.stringify(result.body, null, 2));
    }
    process.exit(1);
  }

  console.log(`${check.label}: OK`);

  if (check.path === "/ready" && result.body) {
    const required = Object.entries(result.body.required || {})
      .map(([name, passed]) => `${name}=${passed ? "ok" : "missing"}`)
      .join(", ");
    const optional = Object.entries(result.body.optional || {})
      .map(([name, passed]) => `${name}=${passed ? "ok" : "missing"}`)
      .join(", ");

    console.log(`  required: ${required}`);
    console.log(`  optional: ${optional}`);
  }
}

console.log("Release smoke checks passed.");
