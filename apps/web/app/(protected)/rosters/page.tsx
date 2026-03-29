import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@repo/database";
import { member, user, organization, certification, invitation, rosterEntry } from "@repo/database/schema";
import { eq, and, ne, inArray } from "@repo/database";
import { DataTable } from "../../../components/roster/data-table";
import { columns, WorkerDetails } from "../../../components/roster/columns";
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
import { ArrowRight, Plus, ShieldCheck, Upload, Users } from "lucide-react";
import Link from "next/link";
import { AddWorkerDialog } from "../../../components/roster/add-worker-dialog";
import { getRequiredOrganizationContext } from "@/lib/server/auth-context";

type RosterSearchParams = {
    onboarding?: "roster" | "roles";
};

export default async function RostersPage(props: { searchParams: Promise<RosterSearchParams> }) {
    const searchParams = await props.searchParams;
    const { activeOrgId } = await getRequiredOrganizationContext();

    // Fetch Workers (Role != owner/admin, or explicitly role = 'member')
    // We want to exclude the actual Platform Admins from this views
    const workersResult = await db.select({
        id: member.id,
        role: member.role,
        joinedAt: member.createdAt,
        jobTitle: member.jobTitle,
        hourlyRate: member.hourlyRate,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            emailVerified: user.emailVerified,
            phoneNumber: user.phoneNumber,
            emergencyContact: user.emergencyContact,
            address: user.address,
        }
    })
        .from(member)
        .leftJoin(user, eq(member.userId, user.id))
        .where(and(
            eq(member.organizationId, activeOrgId),
            ne(member.role, "owner"),
            ne(member.role, "admin")
        ));



    // Fetch Certifications efficiently
    const userIds = workersResult.map(w => w.user!.id).filter(Boolean);
    const certsMap = new Map<string, any[]>();

    if (userIds.length > 0) {
        const certs = await db.select()
            .from(certification)
            .where(inArray(certification.workerId, userIds));

        certs.forEach(c => {
            const existing = certsMap.get(c.workerId) || [];
            existing.push({
                id: c.id,
                name: c.name,
                issuer: c.issuer,
                expiresAt: c.expiresAt, // Ensure Date object
                status: c.status
            });
            certsMap.set(c.workerId, existing);
        });
    }

    // Fetch Pending Invitations
    const invitations = await db.select()
        .from(invitation)
        .where(eq(invitation.organizationId, activeOrgId));

    // Fetch Uninvited (CSV Imports)
    const rosterEntries = await db.select()
        .from(rosterEntry)
        .where(eq(rosterEntry.organizationId, activeOrgId));

    const invitedEmails = new Set(invitations.map(i => i.email));
    const rosterEmails = new Set(rosterEntries.map(re => re.email));

    // 1. Roster Entries (The detailed source of imported/staged data)
    const mappedRoster = rosterEntries.map(re => {
        // If an invitation exists for this email, it is functionally invited
        const isInvited = re.status === "invited" || invitedEmails.has(re.email);
        return {
            id: re.id,
            role: re.role,
            joinedAt: re.createdAt || new Date(),
            jobTitle: re.jobTitle,
            name: re.name,
            email: re.email,
            phone: re.phoneNumber,
            image: null,
            status: (isInvited ? "invited" : "uninvited") as "invited" | "uninvited",
            hourlyRate: re.hourlyRate,
            emergencyContact: null
        };
    });

    const mappedMembers = workersResult.filter(r => r.user !== null).map(r => ({
        id: r.id,
        role: r.role,
        joinedAt: r.joinedAt,
        jobTitle: r.jobTitle,
        name: r.user!.name,
        email: r.user!.email,
        phone: r.user!.phoneNumber,
        image: r.user!.image,
        status: (r.user!.emailVerified ? "active" : "invited") as "active" | "invited",
        hourlyRate: r.hourlyRate,
        emergencyContact: r.user!.emergencyContact as { name: string; phone: string; relation?: string } | null,
    }));

    const memberEmails = new Set(mappedMembers.map(m => m.email));

    // 2. Standalone Invitations (Ones made directly via BetterAuth, not from CSV)
    // We only want to show these if there isn't ALREADY a roster_entry for this email.
    // If there is a roster_entry, the map above already marked it as "invited" and has their Name & Phone!
    const mappedInvitations = invitations
        .filter(i => !rosterEmails.has(i.email) && !memberEmails.has(i.email))
        .map(i => ({
            id: i.id, // Note: This is an invitation ID, not a user/roster ID.
            role: i.role,
            joinedAt: i.createdAt || new Date(),
            jobTitle: i.role,
            name: i.email, // Their name isn't known yet, so we show email
            email: i.email,
            phone: null,
            image: null,
            status: "invited" as const,
            hourlyRate: null,
            emergencyContact: null
        }));

    const workers: WorkerDetails[] = [
        ...mappedMembers,
        ...mappedRoster,
        ...mappedInvitations
    ];

    // Sort workers by joinedAt descending
    workers.sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());

    const onboardingMode = searchParams.onboarding === "roles"
        ? "roles"
        : searchParams.onboarding === "roster"
            ? "roster"
            : null;

    const rosterHeaderDescription = onboardingMode === "roles"
        ? "Review the roles attached to your frontline workforce before you publish your first schedule."
        : onboardingMode === "roster"
            ? "This is your frontline workforce workspace. Add or import the people you plan to schedule."
            : "Manage your frontline workforce and workers.";

    return (
        <div className="flex max-w-5xl flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Roster</h2>
                    <p className="text-muted-foreground">{rosterHeaderDescription}</p>
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
                            <Badge variant="outline" className="rounded-full border-primary/20 bg-white/70 text-primary">
                                Workforce setup
                            </Badge>
                        </div>
                        <div className="flex flex-col gap-2">
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                {onboardingMode === "roles" ? "Review workforce roles" : "Build your roster"}
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
                                <span className="font-medium text-foreground">Roster</span> is for your frontline workforce.{" "}
                                <span>Settings &gt; Team stays separate for admin and manager access.</span>
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
                            <Link href="/dashboard/onboarding">
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
