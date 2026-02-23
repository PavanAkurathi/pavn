import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@repo/database";
import { member, user, organization, certification, invitation, rosterEntry } from "@repo/database/schema";
import { eq, and, ne, inArray } from "@repo/database";
import { DataTable } from "../../../components/roster/data-table";
import { columns, WorkerDetails } from "../../../components/roster/columns";

export default async function RostersPage() {
    const sessionResponse = await auth.api.getSession({
        headers: await headers()
    });

    if (!sessionResponse) {
        redirect("/auth/sign-in");
    }

    const { user: currentUser, session } = sessionResponse;
    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    let activeOrgId = (session as any).activeOrganizationId as string | undefined;

    if (!activeOrgId) {
        // Fallback: Check if user has any memberships
        const membership = await db.query.member.findFirst({
            where: eq(member.userId, currentUser.id)
        });

        if (membership) {
            activeOrgId = membership.organizationId;
        } else {
            return <div>No active organization</div>;
        }
    }

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
    const mappedInvitations = invitations
        .filter(i => !rosterEmails.has(i.email) && !memberEmails.has(i.email))
        .map(i => ({
            id: i.id,
            role: i.role,
            joinedAt: i.createdAt || new Date(),
            jobTitle: i.role,
            name: i.email,
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

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Roster</h2>
                    <p className="text-muted-foreground">Manage your field staff and workers.</p>
                </div>
            </div>

            <DataTable columns={columns} data={workers} />
        </div>
    );
}
