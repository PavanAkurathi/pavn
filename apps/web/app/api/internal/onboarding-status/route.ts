import { NextResponse } from "next/server";
import { getCurrentBusinessOnboardingState, isOnboardingMockModeEnabled } from "@/lib/onboarding";

export const runtime = "nodejs";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mockMode = isOnboardingMockModeEnabled(searchParams.get("mock") === "1");
    const { session, onboarding, shouldEnforceOnboarding, memberRole, isMockMode } =
        await getCurrentBusinessOnboardingState({ mock: mockMode });

    if (!session) {
        return NextResponse.json(
            { hasOnboarding: false, isComplete: false },
            { status: 401 }
        );
    }

    return NextResponse.json({
        hasOnboarding: Boolean(onboarding),
        isComplete: onboarding?.isComplete ?? false,
        memberRole,
        requiresOnboarding: shouldEnforceOnboarding,
        isMockMode,
    });
}
