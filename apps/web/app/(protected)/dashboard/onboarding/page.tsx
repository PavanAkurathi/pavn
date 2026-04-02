import { redirect } from "next/navigation";
import { BusinessOnboardingView } from "@/components/onboarding/business-onboarding-view";
import { getCurrentBusinessOnboardingState } from "@/lib/onboarding";

type SearchParams = Promise<{
    step?: string;
}>;

export default async function BusinessOnboardingPage(props: { searchParams: SearchParams }) {
    const searchParams = await props.searchParams;
    const { session, onboarding, shouldEnforceOnboarding } = await getCurrentBusinessOnboardingState();

    if (!session) {
        redirect("/auth/login");
    }

    if (!onboarding) {
        redirect("/dashboard/shifts");
    }

    if (!shouldEnforceOnboarding) {
        redirect("/dashboard/shifts");
    }

    return (
        <BusinessOnboardingView
            onboarding={onboarding}
            requestedStepId={searchParams.step}
        />
    );
}
