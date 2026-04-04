import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, Sparkles } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@repo/ui/components/ui/card";
import type { OnboardingStep } from "@repo/contracts/onboarding";

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
        <Card className="border-border/70 bg-slate-50/80 shadow-sm">
            <CardHeader className="gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                        Go-live follow-up
                    </Badge>
                    <Badge variant="outline">
                        Optional next steps
                    </Badge>
                </div>
                <div className="flex flex-col gap-2">
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-red-600" />
                        Your first live shift is out. Keep refining the workspace.
                    </CardTitle>
                    <CardDescription className="max-w-3xl text-sm leading-6">
                        Onboarding is no longer blocking you. These are the remaining admin tasks worth tightening after the business is already live.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {steps.map((step) => (
                    <div
                        key={step.id}
                        className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background p-4 sm:flex-row sm:items-start sm:justify-between"
                    >
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                                {step.complete ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                ) : (
                                    <CircleDashed className="h-5 w-5 text-slate-400" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                    {step.description}
                                </p>
                                <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                    {step.supportingText}
                                </p>
                            </div>
                        </div>
                        {!step.complete ? (
                            <Button asChild variant="outline" size="sm" className="shrink-0">
                                <Link href={step.href}>
                                    Open
                                    <ArrowRight data-icon="inline-end" />
                                </Link>
                            </Button>
                        ) : (
                            <Badge variant="outline" className="shrink-0 border-emerald-200 text-emerald-700">
                                Done
                            </Badge>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
