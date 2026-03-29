// apps/web/app/(protected)/dashboard/shifts/page.tsx

import { redirect } from "next/navigation";
import { ShiftsView } from "@/components/shifts/shifts-view";
import { ApprovalBanner } from "@/components/dashboard/approval-banner";
import { DraftBanner } from "@/components/dashboard/draft-banner";
import { getLocations } from "@repo/organizations";
import { getShifts, getPendingShiftsCount, getDraftShiftsCount } from "@/lib/api/shifts";
import { getRequiredOrganizationContext } from "@/lib/server/auth-context";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function ShiftsPage(props: {
    searchParams: SearchParams
}) {
    const searchParams = await props.searchParams;
    const viewParam = typeof searchParams.view === 'string' ? searchParams.view : undefined;
    const view = (viewParam === 'upcoming' || viewParam === 'past' || viewParam === 'needs_approval') ? viewParam : 'upcoming';

    const { activeOrgId: orgId } = await getRequiredOrganizationContext();

    const [shifts, pendingCount, draftCount, locations] = await Promise.all([
        getShifts({ view, orgId }),
        getPendingShiftsCount(orgId),
        getDraftShiftsCount(orgId),
        getLocations(orgId),
    ]);

    // Fix: Map DB locations to Frontend Location type (handle null address)
    const mappedLocations = locations.map(l => ({
        id: l.id,
        name: l.name,
        address: l.address || "",
        timezone: l.timezone || undefined, // Ensure compatible type
    }));

    return (
        <div className="space-y-6">
            <ApprovalBanner count={pendingCount} />
            <DraftBanner count={draftCount} />

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
            />
        </div>
    );
}
