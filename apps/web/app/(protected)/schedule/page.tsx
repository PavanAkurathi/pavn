import Link from "next/link";
import type { SchedulerWeek } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { getOrganizationLocations } from "@/lib/api/organizations";
import { getOnboardingHref } from "@/lib/routes";
import { apiJsonRequest } from "@/lib/server/api-client";
import { getRequiredOrganizationContext } from "@/lib/server/auth-context";
import { Scheduler } from "./_components/scheduler";

type SearchParams = Promise<{ location?: string | string[]; week?: string | string[] }>;

const single = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
const isLocalDate = (value: string | undefined): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
            <h1 className="text-xl font-semibold">{title}</h1>
            <div className="text-sm text-muted-foreground">{children}</div>
        </div>
    );
}

export default async function SchedulePage(props: { searchParams: SearchParams }) {
    const searchParams = await props.searchParams;
    const { activeOrgId } = await getRequiredOrganizationContext({
        missingOrganizationRedirectTo: getOnboardingHref(),
    });

    const locations = await getOrganizationLocations(activeOrgId);
    if (!locations.length) {
        return (
            <Notice title="Add a location first">
                <p>Schedules are built per location, in its local time.</p>
                <Button asChild className="mt-4">
                    <Link href="/settings/locations">Add a location</Link>
                </Button>
            </Notice>
        );
    }

    const requestedLocation = single(searchParams.location);
    const location = locations.find((l) => l.id === requestedLocation) ?? locations[0]!;
    const requestedWeek = single(searchParams.week);
    const weekParam = isLocalDate(requestedWeek) ? requestedWeek : null;

    const query = new URLSearchParams({ locationId: location.id });
    if (weekParam) query.set("weekStart", weekParam);

    let week: SchedulerWeek;
    try {
        week = await apiJsonRequest<SchedulerWeek>(`/scheduler/week?${query}`, {
            organizationScoped: true,
            organizationId: activeOrgId,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (/forbidden|manager/i.test(message)) {
            return (
                <Notice title="The schedule is for managers">
                    <p>Your shifts are in the Workers Hive app on your phone.</p>
                </Notice>
            );
        }
        throw error;
    }

    return (
        <Scheduler
            orgId={activeOrgId}
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
            initialWeek={week}
            initialLocationId={location.id}
            initialWeekParam={weekParam}
        />
    );
}
