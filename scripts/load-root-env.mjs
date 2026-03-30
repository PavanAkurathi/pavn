import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function parseValue(rawValue) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return "";
  }

  const quote = trimmed[0];
  if ((quote === "\"" || quote === "'") && trimmed.endsWith(quote)) {
    const inner = trimmed.slice(1, -1);

    if (quote === "\"") {
      return inner
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, "\"")
        .replace(/\\\\/g, "\\");
    }

    return inner;
  }

  const commentIndex = trimmed.indexOf(" #");
  return commentIndex >= 0 ? trimmed.slice(0, commentIndex).trim() : trimmed;
}

function parseEnvFile(contents) {
  const parsed = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const separatorIndex = withoutExport.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = withoutExport.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    const rawValue = withoutExport.slice(separatorIndex + 1);
    parsed[key] = parseValue(rawValue);
  }

  return parsed;
}

export function loadRootEnv() {
  const envFiles = [".env", ".env.local"];
  const inheritedKeys = new Set(Object.keys(process.env));

  for (const filename of envFiles) {
    const fullPath = path.join(repoRoot, filename);
    if (!existsSync(fullPath)) {
      continue;
    }

    const parsed = parseEnvFile(readFileSync(fullPath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (inheritedKeys.has(key)) {
        continue;
      }

      process.env[key] = value;
    }
  }
}
