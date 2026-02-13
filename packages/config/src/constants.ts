export const SUBSCRIPTION_PLAN = {
    name: "The Hive Plan",
    price: 30, // USD
    currency: "USD",
    interval: "month",
    trialDays: 15,
} as const;

export const APP_NAME = "Workers Hive";
export const SUPPORT_EMAIL = "support@workershive.com";

// Using a clear object structure for related constants
export const PRICING = {
    MONTHLY_PER_LOCATION: 30,
    TRIAL_DAYS: 15,
} as const;
