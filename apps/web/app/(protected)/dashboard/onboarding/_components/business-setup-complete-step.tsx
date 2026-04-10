"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, CreditCard, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { SUBSCRIPTION } from "@repo/config";
import { markBillingPromptHandled } from "@/actions/organization";
import { getCreateScheduleHref, getDashboardShiftsHref } from "@/lib/routes";

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
        <Card className="rounded-[28px] border-border/70 shadow-lg shadow-black/5">
            <CardHeader className="gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Business setup complete</Badge>
                    <Badge variant="outline">{SUBSCRIPTION.TRIAL_DAYS}-day free trial active</Badge>
                </div>
                <div className="flex flex-col gap-2">
                    <CardTitle>Ready for your first schedule</CardTitle>
                    <CardDescription>
                        Your business settings are in place. Create your first schedule next, and add workforce only when that schedule actually needs people.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Business essentials are finished</AlertTitle>
                    <AlertDescription>
                        Timezone, attendance policy, and your first location are now in place. Billing is optional right now.
                    </AlertDescription>
                </Alert>

                {!billingHandled && (
                    <Alert>
                        <CreditCard className="h-4 w-4" />
                        <AlertTitle>Your free trial is active</AlertTitle>
                        <AlertDescription>
                            No credit card is required to keep moving. Add billing now if you want to lock in subscription details early, or skip and return later from Settings.
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                    <Link href={getCreateScheduleHref()}>
                        Create your first schedule
                        <ArrowRight data-icon="inline-end" />
                    </Link>
                </Button>
                {!billingHandled && (
                    <>
                        <Button asChild variant="outline">
                            <Link href="/settings/billing">
                                Add billing now
                                <ArrowRight data-icon="inline-end" />
                            </Link>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleSkipBilling}
                            disabled={isSkippingBilling}
                        >
                            {isSkippingBilling ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
                            Skip for now
                        </Button>
                    </>
                )}
                <Button asChild variant="ghost">
                    <Link href={getDashboardShiftsHref()}>Go to dashboard</Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
