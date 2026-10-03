// apps/web/app/(protected)/layout.tsx

import { AppShell } from "@/components/app-shell/app-shell";
import { getRequiredSession, getSessionActiveOrganizationId } from "@/lib/server/auth-context";
import { resolveActiveOrganizationId } from "@/lib/active-organization";
import { getOrganizationSummary } from "@/lib/api/organizations";
import { getTrialState } from "@/lib/trial";

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
        <AppShell
            activeOrg={activeOrg}
            trial={getTrialState(activeOrg)}
            user={{
                name: sessionResponse.user.name,
                email: sessionResponse.user.email,
                image: sessionResponse.user.image,
            }}
        >
            {children}
        </AppShell>
    );
}
