// apps/web/app/(protected)/dashboard/shifts/page.tsx

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ShiftsView } from "@/components/shifts/shifts-view";
import { ApprovalBanner } from "@/components/dashboard/approval-banner";
import { DraftBanner } from "@/components/dashboard/draft-banner";
import { getLocations } from "@repo/shifts-service";
import { getShifts, getPendingShiftsCount, getDraftShiftsCount } from "@/lib/api/shifts";

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
    // Fix: Access activeOrganizationId from correct path (session.session.activeOrganizationId)
    const sessionData = session as any;
    let activeOrgId = sessionData.session?.activeOrganizationId || sessionData.activeOrganizationId;

    // FALLBACK: If authentication has no active Org, fetch the first one from DB
    if (!activeOrgId) {
        const { db } = await import("@repo/database");
        const { member } = await import("@repo/database/schema");
        const { eq } = await import("drizzle-orm");

        const firstMembership = await db.query.member.findFirst({
            where: eq(member.userId, session.user.id)
        });

        if (firstMembership) {
            activeOrgId = firstMembership.organizationId;
        } else {
            activeOrgId = "org_default";
        }
    }

    const orgId = activeOrgId;

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
