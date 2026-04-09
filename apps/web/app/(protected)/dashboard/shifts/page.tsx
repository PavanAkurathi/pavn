// apps/web/app/(protected)/dashboard/shifts/page.tsx

import { ShiftsView } from "./_components/shifts-view";
import { ApprovalBanner } from "@/components/dashboard/approval-banner";
import { DraftBanner } from "@/components/dashboard/draft-banner";
import { PostLaunchChecklist } from "@/components/dashboard/post-launch-checklist";
import { getOrganizationLocations } from "@/lib/api/organizations";
import { getShifts, getPendingShiftsCount, getDraftShiftsCount } from "@/lib/api/shifts";
import { getRequiredSession, getSessionActiveOrganizationId } from "@/lib/server/auth-context";
import { resolveActiveOrganizationId } from "@/lib/active-organization";
import { getCurrentBusinessOnboardingState } from "@/lib/onboarding";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function ShiftsPage(props: {
    searchParams: SearchParams
}) {
    const searchParams = await props.searchParams;
    const viewParam = typeof searchParams.view === 'string' ? searchParams.view : undefined;
    const view = viewParam === 'past' ? 'past' : 'upcoming';
    const layoutParam = typeof searchParams.layout === "string" ? searchParams.layout : undefined;
    const session = await getRequiredSession();
    const orgId = await resolveActiveOrganizationId(
        session.user.id,
        getSessionActiveOrganizationId(session),
    );

    const [shifts, pendingCount, draftCount, locations, onboardingState] = await Promise.all([
        getShifts({ view, orgId: orgId ?? undefined }),
        orgId ? getPendingShiftsCount(orgId) : Promise.resolve(0),
        orgId ? getDraftShiftsCount(orgId) : Promise.resolve(0),
        orgId ? getOrganizationLocations(orgId) : Promise.resolve([]),
        getCurrentBusinessOnboardingState(),
    ]);

    const mappedLocations = locations.map((l) => ({
        id: l.id,
        name: l.name,
        address: l.address || "",
        timezone: l.timezone || undefined,
    }));

    return (
        <div className="space-y-6">
            <ApprovalBanner count={pendingCount} />
            <DraftBanner count={draftCount} />
            {onboardingState.onboarding?.isComplete ? (
                <PostLaunchChecklist steps={onboardingState.onboarding.deferredSteps} />
            ) : null}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Shifts</h1>
                    <p className="text-muted-foreground">Manage and schedule shifts for your team.</p>
                </div>
            </div>

            <ShiftsView
                key={view}
                initialShifts={shifts}
                availableLocations={mappedLocations}
                defaultTab={view}
                pendingCount={pendingCount}
                initialLayoutParam={layoutParam}
            />
        </div>
    );
}
