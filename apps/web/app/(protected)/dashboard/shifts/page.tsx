// apps/web/app/(protected)/dashboard/shifts/page.tsx

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ShiftsView } from "@/components/shifts/shifts-view";
import { ApprovalBanner } from "@/components/dashboard/approval-banner";
import { AVAILABLE_LOCATIONS } from "@repo/shifts-service";
import { getShifts, getPendingShiftsCount } from "@/lib/api/shifts";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function ShiftsPage(props: {
    searchParams: SearchParams
}) {
    const searchParams = await props.searchParams;
    const viewParam = typeof searchParams.view === 'string' ? searchParams.view : undefined;
    const view = (viewParam === 'upcoming' || viewParam === 'past' || viewParam === 'needs_approval') ? viewParam : 'upcoming';

    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        redirect("/auth/login");
    }

    // Fetch Data from "Backend" Service
    // TODO: reliable way to get active org id from session or header
    // Casting to any to avoid type error if activeOrganizationId is not in core types yet
    const orgId = (session as any).activeOrganizationId || (session.user as any).activeOrganizationId || "org_default";

    const [shifts, pendingCount] = await Promise.all([
        getShifts({ view, orgId }),
        getPendingShiftsCount(orgId)
    ]);

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
                availableLocations={AVAILABLE_LOCATIONS}
                defaultTab={view}
                pendingCount={pendingCount}
            />
        </div>
    );
}
