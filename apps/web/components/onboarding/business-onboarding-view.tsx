import Link from "next/link";
import {
    ArrowLeft,
    CheckCircle2,
    CreditCard,
    MapPin,
    Settings2,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import {
    Card,
    CardContent,
} from "@repo/ui/components/ui/card";
import { SUBSCRIPTION } from "@repo/config";
import type { BusinessOnboardingState, OnboardingStep } from "@/lib/onboarding";
import { BusinessBasicsStep } from "@/components/onboarding/business-basics-step";
import { LocationBasicsStep } from "@/components/onboarding/location-basics-step";
import { BusinessSetupCompleteStep } from "@/components/onboarding/business-setup-complete-step";

const stepIcons: Record<string, React.ReactNode> = {
    account: <CheckCircle2 className="h-5 w-5" />,
    business: <Settings2 className="h-5 w-5" />,
    location: <MapPin className="h-5 w-5" />,
    billing: <CreditCard className="h-5 w-5" />,
};

const stepNumber: Record<string, string> = {
    account: "01",
    business: "02",
    location: "03",
    billing: "04",
};

function getStepStatus(step: OnboardingStep, activeStepId: string) {
    if (step.complete) return "complete";
    if (step.id === activeStepId) return "active";
    return "upcoming";
}

export function BusinessOnboardingView({
    onboarding,
}: {
    onboarding: BusinessOnboardingState;
}) {
    const progress = Math.round((onboarding.completedCount / onboarding.totalCount) * 100);
    const activeStep = onboarding.steps.find((step) => !step.complete && !step.optional) ?? null;
    const activeStepNumber = activeStep
        ? onboarding.steps.findIndex((step) => step.id === activeStep.id) + 1
        : onboarding.steps.length;

    return (
        <div className="-mx-4 -my-8 min-h-[calc(100vh-4rem)] bg-muted/30 px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-6xl flex-col overflow-hidden rounded-[32px] border bg-background shadow-xl lg:flex-row">
                <aside className="flex w-full flex-col gap-8 bg-slate-950 px-6 py-8 text-white lg:w-[340px] lg:px-8">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium uppercase tracking-[0.24em] text-white/55">
                                Workers Hive
                            </span>
                            <Badge variant="secondary" className="w-fit">
                                {SUBSCRIPTION.TRIAL_DAYS}-day free trial active
                            </Badge>
                        </div>
                        <Link
                            href="/dashboard/shifts"
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Exit setup
                        </Link>
                    </div>

                    <div className="flex flex-col gap-3">
                        <h1 className="text-3xl font-semibold tracking-tight">
                            {onboarding.organizationName}
                        </h1>
                        <p className="text-sm leading-6 text-white/70">
                            Set up the essentials before you publish your first schedule.
                        </p>
                        <p className="text-sm text-white/60">
                            {onboarding.completedCount} of {onboarding.totalCount} required steps complete ({progress}%)
                        </p>
                    </div>

                    <div className="flex flex-col gap-5">
                        {onboarding.steps.map((step) => {
                            const status = getStepStatus(step, activeStep?.id ?? "");

                            return (
                                <div key={step.id} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={[
                                                "flex size-10 items-center justify-center rounded-full border text-sm font-semibold",
                                                status === "complete"
                                                    ? "border-white/20 bg-white/10 text-white"
                                                    : status === "active"
                                                        ? "border-primary/60 bg-primary/15 text-white"
                                                        : "border-white/10 text-white/45",
                                            ].join(" ")}
                                        >
                                            {status === "complete"
                                                ? <CheckCircle2 className="h-5 w-5" />
                                                : stepIcons[step.id] ?? stepNumber[step.id] ?? "•"}
                                        </div>
                                        {step.id !== onboarding.steps[onboarding.steps.length - 1]?.id && (
                                            <div className="mt-2 h-10 w-px bg-white/10" />
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1 pt-1">
                                        <div className="flex items-center gap-2">
                                            <p className={status === "active" ? "text-sm font-medium text-white" : "text-sm font-medium text-white/75"}>
                                                {step.title}
                                            </p>
                                            {step.optional && <Badge variant="outline">Optional</Badge>}
                                        </div>
                                        <p className="max-w-[220px] text-xs leading-5 text-white/55">
                                            {step.supportingText}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <Card className="mt-auto border-white/10 bg-white/5 text-white shadow-none">
                        <CardContent className="flex flex-col gap-2 p-5">
                            <p className="text-sm font-medium text-white">What comes next</p>
                            <p className="text-sm leading-6 text-white/65">
                                Finish business setup first. Workforce and staffing can wait until your first schedule actually needs people.
                            </p>
                        </CardContent>
                    </Card>
                </aside>

                <section className="flex-1 px-4 py-8 sm:px-8 lg:px-10 lg:py-10">
                    <div className="mx-auto flex max-w-2xl flex-col gap-8">
                        <div className="flex flex-col gap-3">
                            <Badge variant="outline" className="w-fit">
                                {activeStep ? `Step ${activeStepNumber} of ${onboarding.steps.length}` : "Setup complete"}
                            </Badge>
                            <div className="flex flex-col gap-2">
                                <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                                    {activeStep ? activeStep.title : "Ready for your first schedule"}
                                </h2>
                                <p className="max-w-xl text-base leading-7 text-muted-foreground">
                                    {activeStep
                                        ? activeStep.description
                                        : "Your business settings are in place. Billing is optional, and workforce setup can wait until your first schedule actually needs people."}
                                </p>
                            </div>
                        </div>

                        {activeStep?.id === "business" && (
                            <BusinessBasicsStep
                                organizationName={onboarding.organizationName}
                                timezone={onboarding.organizationTimezone}
                                attendanceVerificationPolicy={onboarding.attendanceVerificationPolicy}
                                nextHref="/dashboard/onboarding"
                            />
                        )}

                        {activeStep?.id === "location" && (
                            <LocationBasicsStep
                                timezone={onboarding.organizationTimezone}
                                nextHref="/dashboard/onboarding"
                            />
                        )}

                        {!activeStep && (
                            <BusinessSetupCompleteStep billingHandled={onboarding.billingHandled} />
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
