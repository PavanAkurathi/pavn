import { redirect } from "next/navigation";
import { BusinessOnboardingView } from "@/components/onboarding/business-onboarding-view";
import { getCurrentBusinessOnboardingState } from "@/lib/onboarding";
import { getDashboardShiftsHref } from "@/lib/routes";

type SearchParams = Promise<{
    step?: string;
}>;

export default async function BusinessOnboardingPage(props: { searchParams: SearchParams }) {
    const searchParams = await props.searchParams;
    const { session, onboarding, shouldEnforceOnboarding } = await getCurrentBusinessOnboardingState({
        requestedStepId: searchParams.step,
    });

    if (!session) {
        redirect("/auth/login");
    }

    if (!onboarding) {
        redirect(getDashboardShiftsHref());
    }

    if (!shouldEnforceOnboarding) {
        redirect(getDashboardShiftsHref());
    }

    return (
        <BusinessOnboardingView
            onboarding={onboarding}
            requestedStepId={searchParams.step}
        />
    );
}
