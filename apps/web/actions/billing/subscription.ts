"use server";

import type { BillingInfo } from "@repo/contracts/billing";
import { apiJsonRequest } from "@/lib/server/api-client";

export async function getSubscriptionDetails(): Promise<BillingInfo> {
    try {
        return await apiJsonRequest<BillingInfo>("/billing", {
            organizationScoped: true,
        });
    } catch {
        return { status: "inactive" };
    }
}
