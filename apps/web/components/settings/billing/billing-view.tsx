"use client";

import { BillingForm } from "./billing-form";
import { InvoiceHistory, InvoiceItem } from "./invoice-history";

interface BillingViewProps {
    subscriptionStatus: string;
    currentPeriodEnd?: Date;
    invoices: InvoiceItem[];
}

export function BillingView({ subscriptionStatus, currentPeriodEnd, invoices }: BillingViewProps) {
    return (
        <div className="space-y-10">
            <section>
                <div className="mb-4">
                    <h3 className="text-lg font-medium text-slate-900">Subscription Plan</h3>
                    <p className="text-sm text-muted-foreground">
                        Manage your workspace access and payment method via Stripe.
                    </p>
                </div>
                <BillingForm
                    subscriptionStatus={subscriptionStatus}
                    currentPeriodEnd={currentPeriodEnd}
                />
            </section>

            {invoices && invoices.length > 0 && (
                <section>
                    <div className="mb-4">
                        <h3 className="text-lg font-medium text-slate-900">Invoice History</h3>
                        <p className="text-sm text-muted-foreground">
                            Download receipts for tax and reimbursement.
                        </p>
                    </div>
                    <InvoiceHistory invoices={invoices} />
                </section>
            )}
        </div>
    );
}