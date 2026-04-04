"use server";

import type { BillingRedirectSession } from "@repo/contracts/billing";
import { apiJsonRequest } from "@/lib/server/api-client";

export async function createCheckoutSession(): Promise<BillingRedirectSession> {
    try {
        return await apiJsonRequest<BillingRedirectSession>(
            "/billing/checkout-session",
            {
                method: "POST",
                organizationScoped: true,
            },
        );
    } catch (error: any) {
        return { error: error.message || "Failed to create checkout session" };
    }
}
