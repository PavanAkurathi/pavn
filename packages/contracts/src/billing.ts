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

export const BillingRedirectSessionSchema = z.object({
    url: z.string().url().optional(),
    error: z.string().optional(),
});

export const StripeWebhookAcknowledgementSchema = z.object({
    received: z.boolean(),
});

export type BillingInfo = z.infer<typeof BillingInfoSchema>;
export type InvoiceHistoryItem = z.infer<typeof InvoiceHistoryItemSchema>;
export type InvoiceHistory = z.infer<typeof InvoiceHistorySchema>;
export type BillingRedirectSession = z.infer<
    typeof BillingRedirectSessionSchema
>;
