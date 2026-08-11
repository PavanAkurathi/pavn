import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@repo/ui/components/ui/card";
import type { OnboardingStep } from "@repo/contracts/onboarding";

/**
 * Outstanding post-go-live admin tasks, rendered as a side rail so they sit
 * beside the shift list instead of pushing it around. Only steps that are
 * genuinely still open appear — finished ones drop out rather than lingering
 * as "Done" rows.
 */
export function PostLaunchChecklist({
    steps,
}: {
    steps: OnboardingStep[];
}) {
    const remainingSteps = steps.filter((step) => !step.complete);

    if (remainingSteps.length === 0) {
        return null;
    }

    return (
        <aside className="flex flex-col gap-4" aria-label="Remaining setup tasks">
            <div className="flex flex-col gap-1">
                <Badge variant="secondary" className="w-fit">
                    Go-live follow-up
                </Badge>
                <p className="text-sm leading-6 text-muted-foreground">
                    Not blocking you — worth tightening now the business is live.
                </p>
            </div>

            {remainingSteps.map((step) => (
                <Card key={step.id} className="border-border/70 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">{step.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <p className="text-sm leading-6 text-muted-foreground">
                            {step.description}
                        </p>
                        <Link
                            href={step.href}
                            className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                            Open
                            <span className="sr-only"> {step.title}</span>
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </CardContent>
                </Card>
            ))}
        </aside>
    );
}
