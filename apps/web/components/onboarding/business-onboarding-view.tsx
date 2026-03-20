import Link from "next/link";
import {
    ArrowRight,
    Briefcase,
    CheckCircle2,
    CircleDashed,
    MapPin,
    ShieldCheck,
    Sparkles,
    Users,
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
import type { BusinessOnboardingState } from "@/lib/onboarding";

const stepIcons: Record<string, React.ReactNode> = {
    location: <MapPin className="h-5 w-5" />,
    team: <Users className="h-5 w-5" />,
    roles: <Briefcase className="h-5 w-5" />,
    schedule: <Sparkles className="h-5 w-5" />,
};

export function BusinessOnboardingView({
    onboarding,
}: {
    onboarding: BusinessOnboardingState;
}) {
    const progress = Math.round((onboarding.completedCount / onboarding.totalCount) * 100);

    return (
        <div className="max-w-5xl space-y-6">
            <div className="space-y-2">
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    Business Onboarding
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                    Finish setting up {onboarding.organizationName}
                </h1>
                <p className="max-w-2xl text-slate-600">
                    Registration already created your admin account and business workspace.
                    Use this checklist to get to the first live schedule as fast as possible.
                </p>
            </div>

            <Card className="border-slate-200">
                <CardHeader className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Setup progress</CardTitle>
                            <CardDescription>
                                {onboarding.completedCount} of {onboarding.totalCount} required setup steps complete
                            </CardDescription>
                        </div>
                        <Badge className="rounded-full px-3 py-1 text-xs">
                            {progress}% complete
                        </Badge>
                    </div>
                    <Progress value={progress} />
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                    {onboarding.registrationSummary.map((item) => (
                        <div
                            key={item}
                            className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                        >
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{item}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="grid gap-4">
                {onboarding.steps.map((step) => (
                    <Card key={step.id} className="border-slate-200">
                        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4">
                                <div className={`rounded-2xl p-3 ${step.complete ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                    {stepIcons[step.id] ?? <CircleDashed className="h-5 w-5" />}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="font-semibold text-slate-900">{step.title}</h2>
                                        {step.complete ? (
                                            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
                                                Done
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="rounded-full">
                                                Next
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-600">{step.description}</p>
                                    <p className="text-xs text-slate-500">{step.supportingText}</p>
                                </div>
                            </div>

                            <Button asChild variant={step.complete ? "outline" : "default"}>
                                <Link href={step.href}>
                                    {step.complete ? "Review" : "Open"}
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="border-slate-200 bg-slate-900 text-white">
                <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-300" />
                            <p className="text-sm font-medium text-emerald-200">Recommended before launch</p>
                        </div>
                        <h2 className="text-lg font-semibold">Review your business settings and clock-in policy</h2>
                        <p className="max-w-2xl text-sm text-slate-300">
                            Registration created your business, but you should still confirm timezone and attendance verification before inviting workers into live shifts.
                        </p>
                    </div>
                    <Button asChild variant="secondary">
                        <Link href={onboarding.settingsHref}>
                            Open Business Settings
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
