// apps/web/app/(protected)/dashboard/shifts/page.tsx

import { redirect } from "next/navigation";

import { ShiftsView } from "./_components/shifts-view";
import { getOrganizationLocations } from "@/lib/api/organizations";
import { getShifts } from "@/lib/api/shifts";
import { getSchedulerHref } from "@/lib/routes";
import { getRequiredSession, getSessionActiveOrganizationId } from "@/lib/server/auth-context";
import { resolveActiveOrganizationId } from "@/lib/active-organization";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

/**
 * Timesheets: who worked, when they clocked in and out, and what is waiting
 * for approval. Planning (creating, drafting, publishing) lives in the
 * Schedule, so this page has no New shift and no Drafts.
 */
export default async function ShiftsPage(props: {
    searchParams: SearchParams
}) {
    const searchParams = await props.searchParams;
    // Links from when this page also held the upcoming list and the drafts.
    if (searchParams.view === 'upcoming' || searchParams.view === 'drafts') {
        redirect(getSchedulerHref());
    }

    const session = await getRequiredSession();
    const orgId = await resolveActiveOrganizationId(
        session.user.id,
        getSessionActiveOrganizationId(session),
    );

    // Past shifts, plus the upcoming list to pick out the shifts happening now.
    const [past, upcoming, locations] = await Promise.all([
        getShifts({ view: 'past', orgId: orgId ?? undefined }),
        getShifts({ view: 'upcoming', orgId: orgId ?? undefined }),
        orgId ? getOrganizationLocations(orgId) : Promise.resolve([]),
    ]);

    const mappedLocations = locations.map((l) => ({
        id: l.id,
        name: l.name,
        address: l.address || "",
        timezone: l.timezone || undefined,
    }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Timesheets</h1>
                <p className="text-muted-foreground">Who worked, clock-ins and hours. Plan and publish shifts in the Schedule.</p>
            </div>

            <ShiftsView shifts={[...past, ...upcoming]} availableLocations={mappedLocations} />
        </div>
    );
}
