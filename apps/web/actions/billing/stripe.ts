import Stripe from "stripe";

const STRIPE_API_VERSION = "2025-01-27.acacia" as any;

export function isBillingConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
        return null;
    }

    return new Stripe(apiKey, {
        apiVersion: STRIPE_API_VERSION,
    });
}
