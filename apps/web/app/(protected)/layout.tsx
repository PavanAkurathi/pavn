// apps/web/app/(protected)/layout.tsx

import { NavHeader } from "../../components/nav-header";
import { getRequiredSession, getSessionActiveOrganizationId } from "@/lib/server/auth-context";
import { resolveActiveOrganizationId } from "@/lib/active-organization";
import { getOrganizationSummary } from "@/lib/api/organizations";

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const sessionResponse = await getRequiredSession();

    const activeOrgId = await resolveActiveOrganizationId(
        sessionResponse.user.id,
        getSessionActiveOrganizationId(sessionResponse)
    );

    const activeOrg = activeOrgId
        ? await getOrganizationSummary(activeOrgId)
        : null;

    return (
        <div className="min-h-screen bg-slate-50">
            <NavHeader
                activeOrg={activeOrg}
                user={{
                    name: sessionResponse.user.name,
                    email: sessionResponse.user.email,
                    image: sessionResponse.user.image,
                }}
            />
            <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
}
