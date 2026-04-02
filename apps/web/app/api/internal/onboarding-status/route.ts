import { NextResponse } from "next/server";
import { getCurrentBusinessOnboardingState } from "@/lib/onboarding";

export const runtime = "nodejs";

export async function GET() {
    const { session, onboarding, shouldEnforceOnboarding, memberRole } = await getCurrentBusinessOnboardingState();

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
    });
}
