import Link from "next/link";
import {
    ArrowLeft,
    CheckCircle2,
    ClipboardList,
    MapPin,
    Settings2,
    Users,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { SUBSCRIPTION } from "@repo/config";
import { cn } from "@repo/ui/lib/utils";
import type {
    BusinessOnboardingState,
    OnboardingStep,
} from "@repo/contracts/onboarding";
import { BusinessBasicsStep } from "./business-basics-step";
import { LocationBasicsStep } from "./location-basics-step";
import { WorkforceSetupStep } from "./workforce-setup-step";
import { FirstShiftStep } from "./first-shift-step";
import { getDashboardShiftsHref, getOnboardingHref } from "@/lib/routes";

type ActiveStepId = "business" | "location" | "workforce" | "first_shift";

const stepIcons = {
    account: CheckCircle2,
    business: Settings2,
    location: MapPin,
    workforce: Users,
    first_shift: ClipboardList,
} as const;

function resolveActiveStep({
    steps,
    requestedStepId,
}: {
    steps: OnboardingStep[];
    requestedStepId?: string;
}): ActiveStepId {
    const orderedStepIds: ActiveStepId[] = ["business", "location", "workforce", "first_shift"];
    const firstIncomplete = orderedStepIds.find((stepId) => {
        const matchingStep = steps.find((step) => step.id === stepId);
        return matchingStep ? !matchingStep.complete : false;
    });

    if (!requestedStepId || !orderedStepIds.includes(requestedStepId as ActiveStepId)) {
        return firstIncomplete ?? "first_shift";
    }

    const requested = requestedStepId as ActiveStepId;
    const requestedIndex = orderedStepIds.indexOf(requested);
    const blockedByEarlierStep = orderedStepIds.some((stepId, index) => {
        if (index >= requestedIndex) return false;
        const matchingStep = steps.find((step) => step.id === stepId);
        return matchingStep ? !matchingStep.complete : false;
    });

    if (blockedByEarlierStep) {
        return firstIncomplete ?? "first_shift";
    }

    return requested;
}

function getStepStatus(stepId: string, activeStepId: ActiveStepId, complete: boolean) {
    if (stepId === activeStepId) return "active";
    if (complete) return "complete";
    return "upcoming";
}

function buildOnboardingHref(stepId: string) {
    return getOnboardingHref({ step: stepId });
}

export function BusinessOnboardingView({
    onboarding,
    requestedStepId,
}: {
    onboarding: BusinessOnboardingState;
    requestedStepId?: string;
}) {
    const activeStepId = resolveActiveStep({
        steps: onboarding.steps,
        requestedStepId,
    });
    const activeStep = onboarding.steps.find((step) => step.id === activeStepId) ?? null;
    const displaySteps = onboarding.steps;

    return (
        <div className="-mx-4 -my-8 bg-muted/40 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="mx-auto max-w-[1180px]">
                <div className="grid min-h-[calc(100dvh-4rem)] overflow-hidden rounded-[36px] border border-border/70 bg-background shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] lg:h-[calc(100dvh-4rem)] lg:min-h-0 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <aside className="flex flex-col gap-6 bg-slate-950 px-6 py-6 text-white sm:px-8">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/50">
                                    Workers Hive
                                </span>
                                <h1 className="text-[28px] font-semibold tracking-tight text-white">
                                    {onboarding.organizationName}
                                </h1>
                            </div>
                            <Button asChild variant="ghost" size="sm" className="text-white/70 hover:bg-white/5 hover:text-white">
                                <Link href={getDashboardShiftsHref()}>
                                    <ArrowLeft data-icon="inline-start" />
                                    Exit setup
                                </Link>
                            </Button>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2">
                                <Badge className="w-fit border-white/10 bg-white/10 text-white hover:bg-white/10">
                                    {SUBSCRIPTION.TRIAL_DAYS}-day free trial active
                                </Badge>
                            </div>
                            <p className="text-sm font-medium leading-6 text-white/85">
                                Let&apos;s get your business to the first published shift as quickly as possible.
                            </p>
                            <p className="text-sm text-white/55">
                                The hard requirement is simple: set up the basics, add workforce access, and publish one live shift.
                            </p>
                        </div>

                        <div className="flex flex-col gap-1">
                            {displaySteps.map((step, index) => {
                                const Icon = stepIcons[step.id as keyof typeof stepIcons] ?? CheckCircle2;
                                const status = getStepStatus(step.id, activeStepId, step.complete);
                                const href =
                                    step.id === "account"
                                        ? undefined
                                        : step.id === "business"
                                            ? buildOnboardingHref("business")
                                            : step.id === "location"
                                                ? buildOnboardingHref("location")
                                                : step.id === "workforce"
                                                    ? buildOnboardingHref("workforce")
                                                    : step.id === "first_shift"
                                                        ? buildOnboardingHref("first_shift")
                                                        : undefined;
                                const content = (
                                    <div
                                        className={cn(
                                            "flex gap-4 rounded-[24px] px-3 py-3 transition",
                                            status === "active" && "bg-white/6",
                                            href && "hover:bg-white/6",
                                        )}
                                    >
                                        <div className="flex flex-col items-center">
                                            <div
                                                className={cn(
                                                    "flex size-10 items-center justify-center rounded-full border",
                                                    status === "active" && "border-white/25 bg-white/10 text-white",
                                                    status === "complete" && "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
                                                    status === "upcoming" && "border-white/10 text-white/45",
                                                )}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            {index < displaySteps.length - 1 ? (
                                                <div
                                                    className={cn(
                                                        "mt-2 h-12 w-px",
                                                        status === "complete" ? "bg-emerald-200/25" : "bg-white/10",
                                                    )}
                                                />
                                            ) : null}
                                        </div>
                                        <div className="flex min-w-0 flex-col gap-1 pt-1">
                                            <div className="flex items-center gap-2">
                                                <p className={cn("text-sm font-medium", status === "active" ? "text-white" : "text-white/75")}>
                                                    {step.title}
                                                </p>
                                            </div>
                                            <p className="max-w-[210px] text-xs leading-5 text-white/55">
                                                {step.supportingText}
                                            </p>
                                        </div>
                                    </div>
                                );

                                if (href) {
                                    return (
                                        <Link key={step.id} href={href}>
                                            {content}
                                        </Link>
                                    );
                                }

                                return <div key={step.id}>{content}</div>;
                            })}
                        </div>

                        <div className="mt-auto flex flex-col gap-4">
                            <Separator className="bg-white/10" />
                            <Card className="border-white/10 bg-white/5 text-white shadow-none">
                                <CardContent className="flex flex-col gap-2 p-5">
                                    <p className="text-sm font-medium text-white">Aim for the first live shift</p>
                                    <p className="text-sm leading-6 text-white/65">
                                        Billing and manager invites can wait. Getting to one real published shift is what proves the workflow.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </aside>

                    <section className="flex items-center justify-center px-5 py-6 sm:px-10 lg:px-12">
                        <div className="flex w-full max-w-[640px] flex-col gap-6">
                            <div className="flex flex-col gap-4">
                                <Badge variant="outline" className="w-fit">
                                    {activeStep
                                        ? `Step ${onboarding.steps.findIndex((step) => step.id === activeStep.id) + 1} of ${onboarding.totalCount}`
                                        : "Onboarding"}
                                </Badge>
                                <div className="flex flex-col gap-2">
                                    <h2 className="text-4xl font-semibold tracking-tight text-foreground">
                                        {activeStepId === "business"
                                            ? "Let’s set up your business profile"
                                            : activeStepId === "location"
                                                ? "Add your first location"
                                                : activeStepId === "workforce"
                                                    ? "Add your first workers"
                                                    : "Publish your first live shift"}
                                    </h2>
                                    <p className="max-w-[560px] text-[15px] leading-7 text-muted-foreground">
                                        {activeStepId === "business"
                                            ? "We’ll start with the essentials that shape how scheduling and clock-ins work."
                                            : activeStepId === "location"
                                                ? "Pick the main place where schedules are created and workers usually clock in."
                                                : activeStepId === "workforce"
                                                    ? "Worker access is the gate for the mobile experience. Start your roster here before you publish the first live shift."
                                                    : "Drafts are useful, but publishing the first live shift is the actual onboarding finish line."}
                                    </p>
                                </div>
                            </div>

                            {activeStepId === "business" && (
                                <BusinessBasicsStep
                                    organizationName={onboarding.organizationName}
                                    timezone={onboarding.organizationTimezone}
                                    attendanceVerificationPolicy={onboarding.attendanceVerificationPolicy}
                                    nextHref={buildOnboardingHref("location")}
                                />
                            )}

                            {activeStepId === "location" && (
                                <LocationBasicsStep
                                    timezone={onboarding.organizationTimezone}
                                    backHref={buildOnboardingHref("business")}
                                    nextHref={buildOnboardingHref("workforce")}
                                />
                            )}

                            {activeStepId === "workforce" && (
                                <WorkforceSetupStep />
                            )}

                            {activeStepId === "first_shift" && (
                                <FirstShiftStep hasDraftShift={onboarding.hasDraftShift} />
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
