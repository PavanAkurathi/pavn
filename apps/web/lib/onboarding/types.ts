import type { Session } from "@repo/auth/client";
import type { BusinessOnboardingState } from "@repo/contracts/onboarding";

export type CurrentBusinessOnboardingStateResult = {
    session: Session | null;
    onboarding: BusinessOnboardingState | null;
    memberRole: string | null;
    shouldEnforceOnboarding: boolean;
};
