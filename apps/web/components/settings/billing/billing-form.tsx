// apps/web/components/settings/billing-billing-form.tsx

"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Check, CreditCard, Loader2 } from "lucide-react";
import posthog from "posthog-js";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PRICING } from "@repo/config";
import { createCheckoutSession, createCustomerPortal } from "@/actions/billing";

interface BillingFormProps {
    subscriptionStatus: string;
    currentPeriodEnd?: Date | null;
}

export function BillingForm({ subscriptionStatus, currentPeriodEnd }: BillingFormProps) {
    const [loading, setLoading] = useState(false);
    const isActive = subscriptionStatus === "active";

    const handleAction = async () => {
        setLoading(true);
        try {
            if (!isActive) {
                posthog.capture('checkout_started', { price: PRICING.MONTHLY_PER_LOCATION });
            }
            const res = isActive ? await createCustomerPortal() : await createCheckoutSession();

            if (res?.error) {
                toast.error(res.error);
                setLoading(false);
                return;
            }

            if (res?.url) {
                window.location.href = res.url;
            } else {
                // Fallback if no URL returned but no error? 
                setLoading(false);
            }
        } catch (error) {
            console.error(error);
            toast.error("Connection failed.");
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card className={isActive ? "border-slate-200" : "border-slate-900 shadow-md"}>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl">Workers Hive Pro</CardTitle>
                            <CardDescription>
                                {isActive ? "Your plan is active." : "Upgrade to unlock unlimited usage."}
                            </CardDescription>
                        </div>
                        {isActive && <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-1 mb-6">
                        <span className="text-3xl font-bold">${PRICING.MONTHLY_PER_LOCATION}</span>
                        <span className="text-muted-foreground">/mo per location</span>
                    </div>
                    <ul className="space-y-2 mb-6">
                        {["Unlimited Staff", "Up to 5 Locations", "GPS Geofenced Timeclock", "Cross-Org Conflict Detection"].map((f) => (
                            <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                                <Check className="w-4 h-4 text-slate-900" /> {f}
                            </li>
                        ))}
                    </ul>
                    {isActive && currentPeriodEnd && (
                        <div className="text-xs text-muted-foreground">
                            Renews on {new Date(currentPeriodEnd).toLocaleDateString()}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-slate-50/50 border-t pt-6">
                    <Button
                        onClick={handleAction}
                        disabled={loading}
                        className={isActive ? "w-auto" : "w-full bg-slate-900 text-white hover:bg-slate-800"}
                        variant={isActive ? "outline" : "default"}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isActive ? "Manage Subscription" : "Upgrade via Stripe"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}