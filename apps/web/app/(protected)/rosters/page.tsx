import { DataTable } from "../../../components/roster/data-table";
import { columns } from "../../../components/roster/columns";
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
import { ArrowRight, Upload, Users, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AddWorkerDialog } from "../../../components/roster/add-worker-dialog";
import { getRequiredOrganizationContext } from "@/lib/server/auth-context";
import { getRosterWorkers } from "@/lib/api/organizations";
import { getOnboardingHref } from "@/lib/routes";
import type { WorkerDetails } from "../../../components/roster/columns";

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
              : "Manage your frontline workforce and workers.";

    return (
        <div className="flex max-w-5xl flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Roster</h2>
                    <p className="text-muted-foreground">
                        {rosterHeaderDescription}
                    </p>
                </div>
                {!onboardingMode && (
                    <div className="flex items-center gap-2">
                        <Link href="/rosters/import">
                            <Button variant="outline" size="sm">
                                <Upload className="mr-2 h-4 w-4" />
                                Import CSV
                            </Button>
                        </Link>
                        <AddWorkerDialog />
                    </div>
                )}
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
                            <AlertTitle>Keep Team and Roster separate</AlertTitle>
                            <AlertDescription>
                                <span className="font-medium text-foreground">
                                    Roster
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
                            <AddWorkerDialog />
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
    );
}
