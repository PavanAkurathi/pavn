// apps/web/app/(protected)/layout.tsx

import { NavHeader } from "../../components/nav-header";
import { db } from "@repo/database";
import { organization, member } from "@repo/database/schema";
import { eq } from "@repo/database";
import { getRequiredSession, getSessionActiveOrganizationId } from "@/lib/server/auth-context";
import { resolveActiveOrganizationId } from "@/lib/active-organization";

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const sessionResponse = await getRequiredSession();

    let activeOrg = null;
    const activeOrgId = await resolveActiveOrganizationId(
        sessionResponse.user.id,
        getSessionActiveOrganizationId(sessionResponse)
    );

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
