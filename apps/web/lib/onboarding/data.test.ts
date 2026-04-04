import { describe, expect, test } from "bun:test";

import { getMockBusinessOnboardingState } from "@/lib/onboarding/data";

describe("getMockBusinessOnboardingState", () => {
    test("marks prior steps complete for later mock onboarding screens", () => {
        const result = getMockBusinessOnboardingState("location");
        const steps = result.onboarding?.steps || [];

        expect(result.isMockMode).toBe(true);
        expect(result.session?.user.email).toBe("owner@workershive.demo");
        expect(steps.find((step) => step.id === "account")?.complete).toBe(true);
        expect(steps.find((step) => step.id === "business")?.complete).toBe(true);
        expect(steps.find((step) => step.id === "location")?.complete).toBe(false);
    });

    test("prepares first-shift mock state with workforce access and a draft shift", () => {
        const result = getMockBusinessOnboardingState("first_shift");

        expect(result.onboarding?.hasWorkforceAccess).toBe(true);
        expect(result.onboarding?.hasDraftShift).toBe(true);
        expect(result.onboarding?.hasPublishedShift).toBe(false);
    });
});
