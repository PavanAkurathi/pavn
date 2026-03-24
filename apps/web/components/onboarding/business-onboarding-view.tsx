import Link from "next/link";
import {
    ArrowLeft,
    ArrowRight,
    Building2,
    CheckCircle2,
    Circle,
    CreditCard,
    MapPin,
    Settings2,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@repo/ui/components/ui/card";
import { Progress } from "@repo/ui/components/ui/progress";
import { SUPPORT_EMAIL, SUBSCRIPTION } from "@repo/config";
import type { AttendanceVerificationPolicy } from "@repo/config";
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

const stepGuidance: Record<string, string[]> = {
    business: [
        "Confirm the business name that managers will see throughout the app.",
        "Set the timezone that should control schedules, timesheets, and reporting.",
        "Choose the default clock-in verification rule for your business.",
    ],
    location: [
        "Add the first location where managers build schedules and workers clock in.",
        "Start with the minimum details: location name and address.",
        "You can return later to refine geofence details, parking notes, PDFs, and extra instructions.",
    ],
    billing: [
        "Your trial is already active, so billing does not block setup.",
        "Add billing now if you want to lock in subscription details early.",
        "You can also skip and return later from Settings without losing access today.",
    ],
};

const stepActionLabel: Record<string, string> = {
    business: "Open business settings",
    location: "Open location settings",
    billing: "Open billing settings",
};

function getAttendancePolicyLabel(policy: AttendanceVerificationPolicy) {
    switch (policy) {
        case "soft_geofence":
            return "Flexible on-site";
        case "none":
            return "No location check";
        case "strict_geofence":
        default:
            return "On-site required";
    }
}

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
    const attendancePolicyLabel = getAttendancePolicyLabel(onboarding.attendanceVerificationPolicy);

    return (
        <div className="-mx-4 -my-8 min-h-[calc(100vh-4rem)] bg-slate-950 sm:-mx-6 lg:-mx-8">
            <div className="min-h-[calc(100vh-4rem)] lg:grid lg:grid-cols-[340px_minmax(0,1fr)]">
                <aside className="relative overflow-hidden bg-linear-to-b from-slate-950 via-slate-900 to-slate-800 px-6 py-8 text-white lg:px-8">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(217,43,58,0.18),_transparent_45%)]" />
                    <div className="relative flex h-full flex-col gap-8">
                        <div className="space-y-6">
                            <Link
                                href="/dashboard/shifts"
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to dashboard
                            </Link>

                            <div className="space-y-4">
                                <Badge className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white hover:bg-white/10">
                                    {SUBSCRIPTION.TRIAL_DAYS}-day free trial active
                                </Badge>
                                <div className="space-y-2">
                                    <h1 className="text-3xl font-semibold tracking-tight">
                                        Welcome to {onboarding.organizationName}
                                    </h1>
                                    <p className="max-w-xs text-sm leading-6 text-white/70">
                                        Your account is live. Finish the business setup first, then move into your first schedule when the workspace is ready.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                                            Setup progress
                                        </p>
                                        <p className="mt-2 text-sm font-medium text-white/90">
                                            {onboarding.completedCount} of {onboarding.totalCount} steps complete
                                        </p>
                                    </div>
                                    <div className="rounded-full border border-white/10 px-3 py-1 text-sm font-semibold text-white">
                                        {progress}%
                                    </div>
                                </div>
                                <Progress value={progress} className="mt-4 bg-white/10" />
                            </div>
                        </div>

                        <div className="space-y-5">
                            {onboarding.steps.map((step) => {
                                const status = getStepStatus(step, activeStep?.id ?? "");

                                return (
                                    <div key={step.id} className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                            <div
                                                className={[
                                                    "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold",
                                                    status === "complete"
                                                        ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
                                                        : status === "active"
                                                            ? "border-primary/60 bg-primary/15 text-white"
                                                            : "border-white/15 bg-white/5 text-white/50",
                                                ].join(" ")}
                                            >
                                                {step.complete
                                                    ? <CheckCircle2 className="h-5 w-5" />
                                                    : stepNumber[step.id] ?? "•"}
                                            </div>
                                            {step.id !== onboarding.steps[onboarding.steps.length - 1]?.id && (
                                                <div
                                                    className={[
                                                        "mt-2 h-10 w-px",
                                                        step.complete ? "bg-emerald-300/35" : "bg-white/10",
                                                    ].join(" ")}
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-1 pt-1">
                                            <div className="flex items-center gap-2">
                                                <p
                                                    className={[
                                                        "text-sm font-medium",
                                                        status === "active" ? "text-white" : "text-white/78",
                                                    ].join(" ")}
                                                >
                                                    {step.title}
                                                </p>
                                                {status === "active" && (
                                                    <Badge className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-white hover:bg-primary/20">
                                                        Current
                                                    </Badge>
                                                )}
                                                {step.optional && (
                                                    <Badge className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/75 hover:bg-white/10">
                                                        Optional
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="max-w-[220px] text-xs leading-5 text-white/55">
                                                {step.supportingText}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                            <div className="flex items-start gap-3">
                                <div className="rounded-2xl bg-white/10 p-2 text-white/80">
                                    <Sparkles className="h-4 w-4" />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-white">
                                        Need help setting up your business?
                                    </p>
                                    <p className="text-xs leading-5 text-white/65">
                                        Keep setup minimal. Finish business settings first, then build your first schedule and bring in workforce only when the schedule needs people.
                                    </p>
                                    <a
                                        href={`mailto:${SUPPORT_EMAIL}`}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white"
                                    >
                                        Contact {SUPPORT_EMAIL}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                <section className="bg-slate-50 px-4 py-8 sm:px-8 lg:px-12">
                    <div className="mx-auto max-w-3xl space-y-6">
                        <div className="lg:hidden">
                            <Card className="border-slate-200 shadow-sm">
                                <CardContent className="space-y-4 p-5">
                                    <div className="space-y-1">
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                            Setup progress
                                        </p>
                                        <h2 className="text-xl font-semibold text-slate-900">
                                            Finish setting up {onboarding.organizationName}
                                        </h2>
                                    </div>
                                    <Progress value={progress} />
                                    <div className="grid gap-2">
                                        {onboarding.steps.map((step) => (
                                            <div key={step.id} className="flex items-center gap-2 text-sm">
                                                {step.complete ? (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                ) : step.id === activeStep?.id ? (
                                                    <Circle className="h-4 w-4 text-primary" />
                                                ) : (
                                                    <Circle className="h-4 w-4 text-slate-300" />
                                                )}
                                                <span className={step.id === activeStep?.id ? "font-medium text-slate-900" : "text-slate-600"}>
                                                    {step.title}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-3">
                            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
                                Business setup
                            </Badge>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                                    {onboarding.isComplete ? "Ready for your first schedule" : "One focused step at a time"}
                                </h2>
                                <p className="max-w-2xl text-base leading-7 text-slate-600">
                                    {onboarding.isComplete
                                        ? "Your business settings are in place. Billing is optional, and workforce setup can wait until your first schedule actually needs people."
                                        : "Keep setup operational. Finish the business essentials now, then move into scheduling when the workspace is ready."}
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

                        {activeStep ? (
                            <Card className="overflow-hidden border-slate-200 shadow-sm">
                                <div className="border-b border-slate-200 bg-white/80 px-6 py-5">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-2xl bg-slate-900 p-3 text-white">
                                                    {stepIcons[activeStep.id] ?? <Sparkles className="h-5 w-5" />}
                                                </div>
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                                        Current step
                                                    </p>
                                                    <h3 className="text-2xl font-semibold text-slate-950">
                                                        {activeStep.title}
                                                    </h3>
                                                </div>
                                            </div>
                                            <p className="max-w-2xl text-sm leading-6 text-slate-600">
                                                {activeStep.description}
                                            </p>
                                        </div>
                                        <Badge className="rounded-full bg-primary px-3 py-1 text-xs text-white hover:bg-primary">
                                            Step {stepNumber[activeStep.id] ?? "04"}
                                        </Badge>
                                    </div>
                                </div>
                                <CardContent className="space-y-6 p-6">
                                    <div className="grid gap-3">
                                        {stepGuidance[activeStep.id]?.map((item) => (
                                            <div
                                                key={item}
                                                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                                            >
                                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                                <p className="text-sm leading-6 text-slate-700">{item}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        <Button asChild size="lg" className="gap-2">
                                            <Link href={activeStep.href}>
                                                {stepActionLabel[activeStep.id] ?? `Open ${activeStep.title}`}
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                        <Button asChild size="lg" variant="outline" className="gap-2">
                                            <Link href="/dashboard/shifts">
                                                Exit setup for now
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <BusinessSetupCompleteStep billingHandled={onboarding.billingHandled} />
                        )}

                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                        <CardTitle>Already ready</CardTitle>
                                    </div>
                                    <CardDescription>
                                        These parts were completed automatically during registration.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {onboarding.registrationSummary.map((item) => (
                                        <div
                                            key={item}
                                            className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                                        >
                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-slate-500" />
                                        <CardTitle>Current business settings</CardTitle>
                                    </div>
                                    <CardDescription>
                                        These values now come from the same organization record that Settings uses later.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-3">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                                Business timezone
                                            </p>
                                            <p className="mt-2 text-sm font-medium text-slate-900">
                                                {onboarding.organizationTimezone}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                                Clock-in verification
                                            </p>
                                            <p className="mt-2 text-sm font-medium text-slate-900">
                                                {attendancePolicyLabel}
                                            </p>
                                        </div>
                                    </div>
                                    <Button asChild variant="outline" className="gap-2">
                                        <Link href={onboarding.settingsHref}>
                                            Open Business Settings
                                            <ArrowRight className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
