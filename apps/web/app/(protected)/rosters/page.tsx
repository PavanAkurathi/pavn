import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@repo/database";
import { member, user, organization, certification } from "@repo/database/schema";
import { eq, and, ne, inArray } from "drizzle-orm";
import { RosterTable } from "../../../components/roster/roster-table";

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
        hourlyRate: member.hourlyRate,
        jobTitle: member.jobTitle,
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

    const workers = workersResult
        .filter(r => r.user !== null)
        .map(r => ({
            id: r.id,
            role: r.role,
            joinedAt: r.joinedAt,
            hourlyRate: r.hourlyRate,
            jobTitle: r.jobTitle,
            name: r.user!.name,
            email: r.user!.email,
            phone: r.user!.phoneNumber,
            image: r.user!.image,
            status: (r.user!.emailVerified ? "active" : "invited") as "active" | "invited",
            emergencyContact: r.user!.emergencyContact,
            address: r.user!.address,
            certifications: certsMap.get(r.user!.id) || []
        }));

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Roster</h2>
                    <p className="text-muted-foreground">Manage your field staff and workers.</p>
                </div>
            </div>

            <RosterTable data={workers} />
        </div>
    );
}
