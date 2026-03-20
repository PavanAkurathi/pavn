import { redirect } from "next/navigation";
import { getCurrentBusinessOnboardingState } from "@/lib/onboarding";

export default async function DashboardPage() {
    const { session, onboarding } = await getCurrentBusinessOnboardingState();

    if (!session) {
        redirect("/auth/login");
    }

    if (onboarding && !onboarding.isComplete) {
        redirect("/dashboard/onboarding");
    }

    redirect("/dashboard/shifts");
}
