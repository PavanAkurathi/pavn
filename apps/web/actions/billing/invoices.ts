"use server";

import type { InvoiceHistory } from "@repo/contracts/billing";
import { apiJsonRequest } from "@/lib/server/api-client";

export async function getInvoiceHistory(): Promise<InvoiceHistory> {
    try {
        return await apiJsonRequest<InvoiceHistory>("/billing/invoices", {
            organizationScoped: true,
        });
    } catch (error) {
        console.error("Stripe Fetch Error", error);
        return [];
    }
}
