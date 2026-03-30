import { loadRootEnv } from "./load-root-env.mjs";

loadRootEnv();

const required = {
  api: [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
  ],
  web: [
    "NEXT_PUBLIC_APP_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
  ],
  auth_sms: [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
  ],
  workers_app: [
    "EXPO_PUBLIC_API_URL",
    "EXPO_PUBLIC_DUB_PUBLISHABLE_KEY",
  ],
};

const optional = {
  observability: [
    "SENTRY_DSN",
    "EXPO_PUBLIC_SENTRY_DSN",
  ],
  deeplinks: [
    "EXPO_PUBLIC_DUB_DOMAIN",
    "DUB_API_KEY",
    "NEXT_PUBLIC_AUTH_URL",
    "EXPO_PUBLIC_AUTH_API_URL",
    "EXPO_PUBLIC_SHIFTS_API_URL",
    "EXPO_PUBLIC_GEOFENCE_API_URL",
  ],
  better_auth_infra: [
    "BETTER_AUTH_API_KEY",
    "BETTER_AUTH_API_URL",
    "BETTER_AUTH_KV_URL",
  ],
  billing: [
    "STRIPE_SECRET_KEY",
    "STRIPE_PRICE_ID_MONTHLY",
    "STRIPE_WEBHOOK_SECRET",
  ],
  email: [
    "RESEND_API_KEY",
    "EMAIL_FROM",
  ],
};

function audit(keys) {
  const missing = [];
  for (const key of keys) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  return missing;
}

let failed = false;

console.log("Launch env audit");
console.log("================");

for (const [group, keys] of Object.entries(required)) {
  const missing = audit(keys);
  if (missing.length > 0) {
    failed = true;
    console.log(`REQUIRED ${group}: missing ${missing.join(", ")}`);
  } else {
    console.log(`REQUIRED ${group}: OK`);
  }
}

for (const [group, keys] of Object.entries(optional)) {
  const missing = audit(keys);
  if (missing.length > 0) {
    console.log(`OPTIONAL ${group}: missing ${missing.join(", ")}`);
  } else {
    console.log(`OPTIONAL ${group}: OK`);
  }
}

if (failed) {
  process.exitCode = 1;
  console.error("Missing required env vars.");
}
