import { db, sql } from "@repo/database";

const REQUIRED_RUNTIME_ENV = {
    core: [
        "DATABASE_URL",
        "BETTER_AUTH_SECRET",
        "NEXT_PUBLIC_APP_URL",
    ],
    authSms: [
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_PHONE_NUMBER",
    ],
} as const;

const OPTIONAL_RUNTIME_ENV = {
    observability: [
        "SENTRY_DSN",
    ],
    billing: [
        "STRIPE_SECRET_KEY",
        "STRIPE_PRICE_ID_MONTHLY",
        "STRIPE_WEBHOOK_SECRET",
    ],
    cron: [
        "CRON_SECRET",
    ],
    email: [
        "RESEND_API_KEY",
        "EMAIL_FROM",
    ],
} as const;

type RequiredGroupName = keyof typeof REQUIRED_RUNTIME_ENV;
type OptionalGroupName = keyof typeof OPTIONAL_RUNTIME_ENV;

type ReadinessSummary = {
    status: "ready" | "not_ready";
    timestamp: string;
    required: Record<RequiredGroupName | "database", boolean>;
    optional: Record<OptionalGroupName, boolean>;
};

function hasEnv(key: string): boolean {
    return Boolean(process.env[key]?.trim());
}

function groupConfigured(keys: readonly string[]): boolean {
    return keys.every(hasEnv);
}

function missingKeys(keys: readonly string[]): string[] {
    return keys.filter((key) => !hasEnv(key));
}

export function validateApiRuntimeEnv(): void {
    if (process.env.NODE_ENV !== "production") {
        return;
    }

    const missing = Object.values(REQUIRED_RUNTIME_ENV).flatMap((keys) => missingKeys(keys));
    if (missing.length > 0) {
        throw new Error(`[API ENV] Missing required env vars: ${missing.join(", ")}`);
    }
}

async function isDatabaseReady(): Promise<boolean> {
    if (!hasEnv("DATABASE_URL")) {
        return false;
    }

    try {
        await db.execute(sql`select 1 as ready`);
        return true;
    } catch (error) {
        console.warn("[READY] Database check failed:", error);
        return false;
    }
}

export async function getApiReadinessSummary(): Promise<ReadinessSummary> {
    const required = {
        core: groupConfigured(REQUIRED_RUNTIME_ENV.core),
        authSms: groupConfigured(REQUIRED_RUNTIME_ENV.authSms),
        database: await isDatabaseReady(),
    };

    const optional = {
        observability: groupConfigured(OPTIONAL_RUNTIME_ENV.observability),
        billing: groupConfigured(OPTIONAL_RUNTIME_ENV.billing),
        cron: groupConfigured(OPTIONAL_RUNTIME_ENV.cron),
        email: groupConfigured(OPTIONAL_RUNTIME_ENV.email),
    };

    return {
        status: Object.values(required).every(Boolean) ? "ready" : "not_ready",
        timestamp: new Date().toISOString(),
        required,
        optional,
    };
}
