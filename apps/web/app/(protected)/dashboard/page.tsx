import { redirect } from "next/navigation";
import { getCurrentBusinessOnboardingState } from "@/lib/onboarding";
import { getOnboardingHref, getSchedulerHref } from "@/lib/routes";

export default async function DashboardPage() {
    const { session, shouldEnforceOnboarding } = await getCurrentBusinessOnboardingState();

    if (!session) {
        redirect("/auth/login");
    }

    if (shouldEnforceOnboarding) {
        redirect(getOnboardingHref());
    }

    redirect(getSchedulerHref());
}
