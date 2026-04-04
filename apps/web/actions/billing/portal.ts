"use server";

import type { BillingRedirectSession } from "@repo/contracts/billing";
import { apiJsonRequest } from "@/lib/server/api-client";

export async function createCustomerPortal(): Promise<BillingRedirectSession> {
    try {
        return await apiJsonRequest<BillingRedirectSession>(
            "/billing/portal-session",
            {
                method: "POST",
                organizationScoped: true,
            },
        );
    } catch (error: any) {
        return { error: error.message || "Failed to create billing portal" };
    }
}
