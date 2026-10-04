// apps/web/app/(protected)/dashboard/shifts/page.tsx

import { ShiftsView } from "./_components/shifts-view";
import { ApprovalBanner } from "@/components/dashboard/approval-banner";
import { getOrganizationLocations } from "@/lib/api/organizations";
import { getSchedulingSettings } from "@/lib/api/scheduler";
import { getShifts, getPendingShiftsCount, getDraftShifts } from "@/lib/api/shifts";
import { getRequiredSession, getSessionActiveOrganizationId } from "@/lib/server/auth-context";
import { resolveActiveOrganizationId } from "@/lib/active-organization";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function ShiftsPage(props: {
    searchParams: SearchParams
}) {
    const searchParams = await props.searchParams;
    const viewParam = typeof searchParams.view === 'string' ? searchParams.view : undefined;
    const view = viewParam === 'past' ? 'past' : viewParam === 'drafts' ? 'drafts' : 'upcoming';
    const session = await getRequiredSession();
    const orgId = await resolveActiveOrganizationId(
        session.user.id,
        getSessionActiveOrganizationId(session),
    );

    // Drafts are kept in their own tab, a week at a time, so they are always
    // fetched (the tab's count needs them); the week they belong to depends on
    // where the organization's week starts. The Drafts tab has no published
    // shifts of its own to list.
    const [shifts, pendingCount, draftShifts, locations, settings] = await Promise.all([
        view === 'drafts' ? Promise.resolve([]) : getShifts({ view, orgId: orgId ?? undefined }),
        orgId ? getPendingShiftsCount(orgId) : Promise.resolve(0),
        orgId ? getDraftShifts(orgId) : Promise.resolve([]),
        orgId ? getOrganizationLocations(orgId) : Promise.resolve([]),
        orgId ? getSchedulingSettings(orgId).catch(() => null) : Promise.resolve(null),
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

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Shifts</h1>
                    <p className="text-muted-foreground">Manage and schedule shifts for your team.</p>
                </div>
            </div>

            <ShiftsView
                key={view}
                initialShifts={shifts}
                draftShifts={draftShifts}
                availableLocations={mappedLocations}
                defaultTab={view}
                pendingCount={pendingCount}
                weekStartsOn={settings?.weekStartsOn ?? 0}
            />
        </div>
    );
}
