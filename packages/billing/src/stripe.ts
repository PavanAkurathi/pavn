import Stripe from "stripe";

export const STRIPE_API_VERSION = "2025-01-27.acacia" as const;

export function isBillingConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
        return null;
    }

    return new Stripe(apiKey, {
        apiVersion: STRIPE_API_VERSION as any,
        typescript: true,
    });
}

export function requireStripe() {
    const stripe = getStripe();
    if (!stripe) {
        throw new Error("STRIPE_SECRET_KEY is not set");
    }

    return stripe;
}
