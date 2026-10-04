import { DataTable } from "./_components/data-table";
import { columns } from "./_components/columns";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@repo/ui/components/ui/card";
import { ArrowRight, Check, Upload, Users, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { InviteMemberPopover } from "./_components/invite-member-popover";
import { SUBSCRIPTION } from "@repo/config";
import { PageTopBar } from "@/components/app-shell/page-top-bar";
import { getRequiredOrganizationContext } from "@/lib/server/auth-context";
import { getRosterWorkers } from "@/lib/api/organizations";
import { getOnboardingHref } from "@/lib/routes";
import type { WorkerDetails } from "./_components/columns";

type RosterSearchParams = {
    onboarding?: "roster" | "roles";
};

export default async function RostersPage(props: {
    searchParams: Promise<RosterSearchParams>;
}) {
    const searchParams = await props.searchParams;
    const { activeOrgId } = await getRequiredOrganizationContext();
    const workers = (await getRosterWorkers(activeOrgId)).map((worker) => ({
        ...worker,
        role: worker.role ?? null,
        jobTitle: worker.jobTitle ?? null,
        phone: worker.phone ?? null,
        image: worker.image ?? null,
        hourlyRate: worker.hourlyRate ?? null,
        emergencyContact: worker.emergencyContact ?? null,
        joinedAt: new Date(worker.joinedAt),
    })) satisfies WorkerDetails[];

    const onboardingMode =
        searchParams.onboarding === "roles"
            ? "roles"
            : searchParams.onboarding === "roster"
              ? "roster"
              : null;

    const rosterHeaderDescription =
        onboardingMode === "roles"
            ? "Review the roles attached to your frontline workforce before you publish your first schedule."
            : onboardingMode === "roster"
              ? "This is your frontline workforce workspace. Add or import the people you plan to schedule."
              : null;

    const active = workers.filter((w) => w.status === "active").length;
    const waiting = workers.length - active;
    const summary = [`${active} active`, waiting > 0 ? `${waiting} ${waiting === 1 ? "invite" : "invites"} pending` : null].filter(Boolean).join(" · ");

    return (
        <div className="max-w-5xl overflow-hidden rounded-card border bg-card">
            <PageTopBar
                title="Team"
                subtitle={rosterHeaderDescription ?? summary}
                actions={
                    onboardingMode ? null : (
                        <>
                            <Button asChild variant="outline" size="sm">
                                <Link href="/rosters/import">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import CSV
                                </Link>
                            </Button>
                            <InviteMemberPopover />
                        </>
                    )
                }
            />
            <div className="flex flex-col gap-4 bg-background p-4">
            <div className="flex items-start gap-2.5 rounded-panel border border-(--primary-edge) bg-(--primary-soft) px-3.5 py-3">
                <span aria-hidden className="mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" strokeWidth={3} />
                </span>
                <div>
                    <p className="text-[13px] font-bold">
                        ${SUBSCRIPTION.MONTHLY_PRICE_USD}/mo per location, flat: unlimited team members.
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        No per-seat fees, ever. Invite the whole roster; your price never changes.
                    </p>
                </div>
            </div>

            {onboardingMode && (
                <Card className="border-primary/20 bg-primary/5 shadow-sm">
                    <CardHeader className="gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge className="rounded-full bg-primary px-3 py-1 text-white hover:bg-primary">
                                Onboarding
                            </Badge>
                            <Badge
                                variant="outline"
                                className="rounded-full border-primary/20 bg-white/70 text-primary"
                            >
                                Workforce setup
                            </Badge>
                        </div>
                        <div className="flex flex-col gap-2">
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                {onboardingMode === "roles"
                                    ? "Review workforce roles"
                                    : "Build your roster"}
                            </CardTitle>
                            <CardDescription className="max-w-3xl text-sm leading-6">
                                {onboardingMode === "roles"
                                    ? "Confirm the job roles attached to your workforce here so schedules reflect real staffing demand."
                                    : "Import your workforce by CSV/XLSX or add the first few workers manually. Pending invites and roster entries are enough to move forward."}
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <Alert className="bg-background/70">
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                            <AlertTitle>Keep this page and Settings &gt; Team separate</AlertTitle>
                            <AlertDescription>
                                <span className="font-medium text-foreground">
                                    This page
                                </span>{" "}
                                is for your frontline workforce.{" "}
                                <span>
                                    Settings &gt; Team stays separate for admin and
                                    manager access.
                                </span>
                            </AlertDescription>
                        </Alert>
                        <div className="flex flex-wrap gap-3">
                            <Link href="/rosters/import">
                                <Button variant="outline">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import roster CSV
                                </Button>
                            </Link>
                            <InviteMemberPopover />
                            <Link href={getOnboardingHref()}>
                                <Button variant="ghost" className="gap-2">
                                    Return to onboarding
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            <DataTable columns={columns} data={workers} />
            </div>
        </div>
    );
}
