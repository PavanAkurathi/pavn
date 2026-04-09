import type { BusinessOnboardingState, OnboardingStep } from "@repo/contracts/onboarding";
import { isOnboardingEnforcementDisabled } from "./config";
import { getLiveBusinessOnboardingState } from "./live";
import type { CurrentBusinessOnboardingStateResult } from "./types";

export type { BusinessOnboardingState, OnboardingStep, CurrentBusinessOnboardingStateResult };
export { isOnboardingEnforcementDisabled };

export async function getCurrentBusinessOnboardingState(options?: {
    requestedStepId?: string;
}): Promise<CurrentBusinessOnboardingStateResult> {
    const result = await getLiveBusinessOnboardingState(options);

    if (isOnboardingEnforcementDisabled()) {
        return {
            ...result,
            shouldEnforceOnboarding: false,
        };
    }

    return result;
}
