import { redirect } from "next/navigation";
import { getCurrentBusinessOnboardingState } from "@/lib/onboarding";

export default async function DashboardPage() {
    const { session, shouldEnforceOnboarding } = await getCurrentBusinessOnboardingState();

    if (!session) {
        redirect("/auth/login");
    }

    if (shouldEnforceOnboarding) {
        redirect("/dashboard/onboarding");
    }

    redirect("/dashboard/shifts");
}
