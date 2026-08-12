import type { Shift } from "@/lib/types";

const SETTLED_STATUSES = ["completed", "approved", "cancelled"];

/**
 * Week-level read on what is scheduled: volume, planned hours, and the gap.
 *
 * Hours are *planned* — duration times the number of positions, not the number
 * of people currently assigned — so the figure does not drop as slots go
 * unfilled. The unfilled count carries that story instead.
 *
 * Wage cost deliberately absent: the shift payload carries no rate, so it
 * cannot be computed here without inventing a number.
 */
export function ScheduleSummary({ shifts }: { shifts: Shift[] }) {
    if (!shifts || shifts.length === 0) {
        return null;
    }

    let plannedHours = 0;
    let unfilled = 0;

    for (const shift of shifts) {
        const total = shift.capacity?.total ?? 0;
        const filled = shift.capacity?.filled ?? shift.assignedWorkers?.length ?? 0;
        const durationHours =
            (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3_600_000;

        if (durationHours > 0) {
            plannedHours += durationHours * Math.max(total, 1);
        }

        if (!SETTLED_STATUSES.includes(shift.status)) {
            unfilled += Math.max(total - filled, 0);
        }
    }

    const roundedHours = Math.round(plannedHours);

    return (
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border/70 bg-muted/30 px-4 py-2.5 text-sm">
            <div className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">Shifts</dt>
                <dd className="font-semibold tabular-nums text-foreground">{shifts.length}</dd>
            </div>

            <div className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">Planned hours</dt>
                <dd className="font-semibold tabular-nums text-foreground">{roundedHours}h</dd>
            </div>

            <div className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">Needs cover</dt>
                <dd
                    className={`font-semibold tabular-nums ${unfilled > 0 ? "text-destructive" : "text-foreground"}`}
                >
                    {unfilled}
                </dd>
            </div>
        </dl>
    );
}
