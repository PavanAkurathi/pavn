import { getOnboardingHref } from "@/lib/routes";
import { getRequiredOrganizationContext } from "@/lib/server/auth-context";
import { RequestsView } from "./_components/requests-view";

export default async function RequestsPage() {
    await getRequiredOrganizationContext({ missingOrganizationRedirectTo: getOnboardingHref() });
    return <RequestsView />;
}
