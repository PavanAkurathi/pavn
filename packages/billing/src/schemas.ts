import { z } from "zod";

export const BillingInfoSchema = z.object({
    status: z.string(),
    currentPeriodEnd: z.string().datetime().nullable().optional(),
    stripeCustomerId: z.string().nullable().optional(),
    stripeSubscriptionId: z.string().nullable().optional(),
});

export const InvoiceHistoryItemSchema = z.object({
    id: z.string(),
    date: z.string(),
    amount: z.string(),
    status: z.enum(["paid", "open", "void", "uncollectible"]),
    invoiceUrl: z.string().nullable(),
    description: z.string(),
});

export const InvoiceHistorySchema = z.array(InvoiceHistoryItemSchema);

export type BillingInfo = z.infer<typeof BillingInfoSchema>;
export type InvoiceHistoryItem = z.infer<typeof InvoiceHistoryItemSchema>;
