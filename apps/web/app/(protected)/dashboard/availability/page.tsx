// apps/web/app/(protected)/dashboard/availability/page.tsx
import { SetAvailabilityForm } from "../../../../components/availability/set-availability-form";

export default function AvailabilityPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight">My Availability</h1>
                <p className="text-muted-foreground">
                    Block off times when you are unavailable to work.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                    <SetAvailabilityForm />
                </div>
                {/* Future: List of current blocks */}
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <h3 className="font-semibold leading-none tracking-tight mb-4">Upcoming Unavailability</h3>
                    <p className="text-sm text-muted-foreground">
                        No upcoming unavailable times set.
                    </p>
                </div>
            </div>
        </div>
    );
}
