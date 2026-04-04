import { redirect } from "next/navigation";
import { BusinessOnboardingView } from "@/components/onboarding/business-onboarding-view";
import { getCurrentBusinessOnboardingState, isOnboardingMockModeEnabled } from "@/lib/onboarding";

type SearchParams = Promise<{
    step?: string;
    mock?: string;
}>;

export default async function BusinessOnboardingPage(props: { searchParams: SearchParams }) {
    const searchParams = await props.searchParams;
    const mockMode = isOnboardingMockModeEnabled(searchParams.mock === "1");
    const { session, onboarding, shouldEnforceOnboarding, isMockMode } = await getCurrentBusinessOnboardingState({
        mock: mockMode,
        requestedStepId: searchParams.step,
    });

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
            mockMode={isMockMode}
        />
    );
}
