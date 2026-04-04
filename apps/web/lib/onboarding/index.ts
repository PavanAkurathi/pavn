import type {
    BusinessOnboardingState,
    OnboardingStep,
} from "@repo/contracts/onboarding";
import {
    getMockBusinessOnboardingState,
    isOnboardingMockModeEnabled,
    type CurrentBusinessOnboardingStateResult,
} from "./data";
import { isOnboardingEnforcementDisabled } from "./config";
import { getLiveBusinessOnboardingState } from "./live";

export type { BusinessOnboardingState, OnboardingStep, CurrentBusinessOnboardingStateResult };
export { isOnboardingEnforcementDisabled, isOnboardingMockModeEnabled };

export async function getCurrentBusinessOnboardingState(options?: {
    mock?: boolean;
    requestedStepId?: string;
}): Promise<CurrentBusinessOnboardingStateResult> {
    const result = isOnboardingMockModeEnabled(options?.mock)
        ? getMockBusinessOnboardingState(options?.requestedStepId)
        : await getLiveBusinessOnboardingState();

    if (isOnboardingEnforcementDisabled()) {
        return {
            ...result,
            shouldEnforceOnboarding: false,
        };
    }

    return result;
}
