"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, CreditCard, Loader2, Sparkles } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { SUBSCRIPTION } from "@repo/config";
import { markBillingPromptHandled } from "@/actions/organization";

export function BusinessSetupCompleteStep({
    billingHandled,
}: {
    billingHandled: boolean;
}) {
    const router = useRouter();
    const [isSkippingBilling, setIsSkippingBilling] = useState(false);

    const handleSkipBilling = async () => {
        setIsSkippingBilling(true);

        try {
            const result = await markBillingPromptHandled();
            if (result?.error) {
                toast.error(result.error);
                return;
            }

            toast.success("You can add billing later from Settings.");
            router.refresh();
        } catch {
            toast.error("Failed to update billing preference.");
        } finally {
            setIsSkippingBilling(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card className="border-emerald-200 bg-emerald-50/70 shadow-sm">
                <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <Badge className="rounded-full bg-emerald-100 text-emerald-800 shadow-none hover:bg-emerald-100">
                            Business setup complete
                        </Badge>
                    </div>
                    <CardTitle>Let&apos;s create your first schedule</CardTitle>
                    <CardDescription>
                        Your business settings are ready. Next, create your first schedule. You can add workforce later when the schedule actually needs people.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                    <Button asChild size="lg" className="gap-2 rounded-full px-8">
                        <Link href="/dashboard/schedule/create">
                            Create your first schedule
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="rounded-full px-8">
                        <Link href="/dashboard/shifts">Go to dashboard</Link>
                    </Button>
                </CardContent>
            </Card>

            {!billingHandled && (
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
                                Optional
                            </Badge>
                            <Badge className="rounded-full bg-white text-slate-700 shadow-none hover:bg-white">
                                {SUBSCRIPTION.TRIAL_DAYS}-day free trial active
                            </Badge>
                        </div>
                        <div className="space-y-2">
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-slate-500" />
                                Add billing now or skip for now
                            </CardTitle>
                            <CardDescription>
                                No credit card is required to finish setup. Add billing now if you want to lock in your subscription details, or skip and return later from Settings.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-3">
                        <Button asChild variant="outline">
                            <Link href="/settings/billing">
                                Review billing options
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            className="gap-2 text-slate-700"
                            onClick={handleSkipBilling}
                            disabled={isSkippingBilling}
                        >
                            {isSkippingBilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            Skip for now
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
