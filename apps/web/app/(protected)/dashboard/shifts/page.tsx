// apps/web/app/(protected)/dashboard/shifts/page.tsx

import { ShiftsView } from "./_components/shifts-view";
import { ApprovalBanner } from "@/components/dashboard/approval-banner";
import { DraftBanner } from "@/components/dashboard/draft-banner";
import { getOrganizationLocations } from "@/lib/api/organizations";
import { getShifts, getPendingShiftsCount, getDraftShifts } from "@/lib/api/shifts";
import { getRequiredSession, getSessionActiveOrganizationId } from "@/lib/server/auth-context";
import { resolveActiveOrganizationId } from "@/lib/active-organization";
import { filterDraftShifts } from "@/lib/shifts/view-list";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function ShiftsPage(props: {
    searchParams: SearchParams
}) {
    const searchParams = await props.searchParams;
    const viewParam = typeof searchParams.view === 'string' ? searchParams.view : undefined;
    const view = viewParam === 'past' ? 'past' : 'upcoming';
    const session = await getRequiredSession();
    const orgId = await resolveActiveOrganizationId(
        session.user.id,
        getSessionActiveOrganizationId(session),
    );

    // Drafts come back as a list: the banner links to their week in the
    // Scheduler, and the list shows them marked as drafts.
    const [shifts, pendingCount, draftShifts, locations] = await Promise.all([
        getShifts({ view, orgId: orgId ?? undefined }),
        orgId ? getPendingShiftsCount(orgId) : Promise.resolve(0),
        orgId ? getDraftShifts(orgId) : Promise.resolve([]),
        orgId ? getOrganizationLocations(orgId) : Promise.resolve([]),
    ]);

    const upcomingDrafts = filterDraftShifts(draftShifts);


    const mappedLocations = locations.map((l) => ({
        id: l.id,
        name: l.name,
        address: l.address || "",
        timezone: l.timezone || undefined,
    }));

    return (
        <div className="space-y-6">
            <ApprovalBanner count={pendingCount} />
            <DraftBanner drafts={upcomingDrafts} />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Shifts</h1>
                    <p className="text-muted-foreground">Manage and schedule shifts for your team.</p>
                </div>
            </div>

            <ShiftsView
                key={view}
                initialShifts={shifts}
                draftShifts={upcomingDrafts}
                availableLocations={mappedLocations}
                defaultTab={view}
                pendingCount={pendingCount}
            />
        </div>
    );
}
