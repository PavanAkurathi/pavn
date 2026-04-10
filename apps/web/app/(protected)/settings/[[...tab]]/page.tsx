// apps/web/app/(protected)/settings/[[...tab]]/page.tsx

import { SettingsView } from "../_components/settings-view";
import { getInvoiceHistory, getSubscriptionDetails } from "@/actions/billing";
import {
    getSecurityOverview,
    getWorkspaceSettings,
} from "@/lib/api/organizations";
import { getOnboardingHref } from "@/lib/routes";
import { getRequiredOrganizationContext } from "@/lib/server/auth-context";
import { isAdminOrganizationRole } from "@/lib/server/organization-roles";

export default async function SettingsPage(props: {
    params: Promise<{ tab?: string[] }>;
}) {
    const params = await props.params;
    const activeTab = params.tab?.[0] || "profile";

    const { session, activeOrgId } = await getRequiredOrganizationContext({
        missingOrganizationRedirectTo: getOnboardingHref(),
    });

    const [workspace, security] = await Promise.all([
        getWorkspaceSettings(activeOrgId),
        getSecurityOverview(),
    ]);

    const role = workspace.role || "member";

    const [subscription, invoices] =
        isAdminOrganizationRole(role) && activeTab === "billing"
            ? await Promise.all([
                  getSubscriptionDetails(),
                  getInvoiceHistory(),
              ])
            : [{ status: "inactive" }, []];

    return (
        <SettingsView
            activeTab={activeTab}
            user={{
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
                emailVerified: session.user.emailVerified,
                phoneNumber: (session.user as any).phoneNumber,
            }}
            organization={workspace.organization}
            locations={workspace.locations}
            role={role}
            sessions={security.sessions}
            accounts={security.accounts}
            members={workspace.members}
            canManageWorkspace={isAdminOrganizationRole(role)}
            subscription={{
                ...subscription,
                currentPeriodEnd: subscription.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd)
                    : undefined,
            }}
            invoices={invoices}
        />
    );
}
