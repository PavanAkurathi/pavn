export const APP_NAME = "Workers Hive";
export const SUPPORT_EMAIL = "support@workershive.com";

// ── Subscription ──────────────────────────────────────────────────────────────
export const SUBSCRIPTION = {
    PLAN_NAME: "pro",
    MONTHLY_PRICE_USD: 30,
    TRIAL_DAYS: 14,
    CURRENCY: "USD",
    UNLIMITED_WORKERS: true,
} as const;

// ── Plan Limits ───────────────────────────────────────────────────────────────
export const PLAN_LIMITS = {
    MAX_LOCATIONS: 5,
    MAX_ORGANIZATIONS_PER_WORKER: 10,
} as const;

// ── OTP ───────────────────────────────────────────────────────────────────────
export const OTP = {
    EMAIL_EXPIRY_SECONDS: 600,  // 10 minutes for email
    SMS_EXPIRY_SECONDS: 300,    // 5 minutes for SMS
    LENGTH: 6,
} as const;

// ── Worker Invitation ─────────────────────────────────────────────────────────
export const WORKER_INVITE = {
    EXPIRY_HOURS: 72,
    DEFAULT_CONTACT: "phone" as "phone" | "email",
} as const;
