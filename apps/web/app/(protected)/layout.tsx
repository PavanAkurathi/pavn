// apps/web/app/(protected)/layout.tsx

import { NavHeader } from "../../components/nav-header";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { organization, member } from "@repo/database/schema";
import { eq } from "@repo/database";

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const sessionResponse = await auth.api.getSession({
        headers: await headers()
    });

    let activeOrg = null;
    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    let activeOrgId = (sessionResponse?.session as any)?.activeOrganizationId as string | undefined;

    // Fallback: If no active org in session, find the first membership
    if (!activeOrgId && sessionResponse?.user?.id) {
        const membership = await db.query.member.findFirst({
            where: eq(member.userId, sessionResponse.user.id)
        });
        if (membership) {
            activeOrgId = membership.organizationId;
        }
    }

    if (activeOrgId) {
        const orgData = await db.query.organization.findFirst({
            where: eq(organization.id, activeOrgId),
            columns: { id: true, name: true, logo: true }
        });
        if (orgData) activeOrg = orgData;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <NavHeader activeOrg={activeOrg} />
            <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
}
