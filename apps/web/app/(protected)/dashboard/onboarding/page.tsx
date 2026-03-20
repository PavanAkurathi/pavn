import { redirect } from "next/navigation";
import { BusinessOnboardingView } from "@/components/onboarding/business-onboarding-view";
import { getCurrentBusinessOnboardingState } from "@/lib/onboarding";

export default async function BusinessOnboardingPage() {
    const { session, onboarding } = await getCurrentBusinessOnboardingState();

    if (!session) {
        redirect("/auth/login");
    }

    if (!onboarding) {
        redirect("/dashboard/shifts");
    }

    return <BusinessOnboardingView onboarding={onboarding} />;
}
