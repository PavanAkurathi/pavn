import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { format, parseISO } from "date-fns";
import type { Shift } from "@/lib/types";
import { getLocalParts, getShiftClock } from "@/lib/shifts/shift-time";

interface ShiftCardProps {
    shifts: Shift[];
    onClick?: (shift: Shift) => void;
    /** A finished shift still waiting on its timesheet to be approved. */
    isUrgent?: boolean;
    /** A second link on the right of the bottom row, e.g. "Review timesheet". */
    actionLabel?: string;
}

/** Faces shown in the stack before it ends in "+N". */
const AVATAR_STACK_SIZE = 3;

const WORKER_KIND_NOUN = {
    roster: "on the roster",
    invited: "invited, not accepted yet",
    agency: "agency",
} as const;

function filledOf(shift: Shift) {
    return shift.capacity?.filled ?? shift.assignedWorkers?.length ?? 0;
}

/** A shift's title is the position it staffs; a block can hold several. */
function blockTitle(shifts: Shift[]) {
    const titles = [...new Set(shifts.map((shift) => shift.title))];
    if (titles.length <= 2) return titles.join(" · ");
    return `${titles[0]} · +${titles.length - 1} more`;
}

/**
 * One scheduled block as a full-width row.
 *
 * Each entry in `shifts` is a position within the same block: same time, same
 * location, different role. The row adds them up (one fill count, one stack of
 * faces) and opens the first one, which is where the roster is.
 */
export function ShiftCard({ shifts, onClick, isUrgent, actionLabel }: ShiftCardProps) {
    if (!shifts || shifts.length === 0) return null;

    const primaryShift = shifts[0]!;
    const locationName = (primaryShift.locationName || "").trim();
    const startTime = parseISO(primaryShift.startTime);
    const endTime = parseISO(primaryShift.endTime);
    const clock = getShiftClock(startTime, endTime, primaryShift.timezone);
    // The day at the location, to match the list's date headers.
    const localDay = parseISO(getLocalParts(startTime, primaryShift.timezone).date);

    const total = shifts.reduce((sum, s) => sum + (s.capacity?.total ?? 0), 0);
    const filled = shifts.reduce((sum, s) => sum + filledOf(s), 0);
    const isFull = total > 0 && filled >= total;
    // Nothing enforces capacity server-side yet, so say so rather than calling it full.
    const overCapacityBy = shifts.reduce(
        (sum, s) => sum + Math.max(filledOf(s) - (s.capacity?.total ?? 0), 0),
        0,
    );

    const workers = [
        ...new Map(shifts.flatMap((s) => s.assignedWorkers ?? []).map((w) => [w.id, w])).values(),
    ];

    const open = (e?: React.MouseEvent | React.KeyboardEvent) => {
        e?.stopPropagation();
        onClick?.(primaryShift);
    };

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`View shift at ${locationName || "location"} on ${format(localDay, "EEEE, MMMM d")}`}
            className="group cursor-pointer rounded-[14px] border border-border bg-card px-5 py-[18px] transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={open}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open(e);
                }
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <h3 className="text-[16.5px] font-extrabold leading-snug tracking-tight text-foreground">
                    {blockTitle(shifts)}
                </h3>
                <span className="shrink-0 whitespace-nowrap text-[14.5px] font-extrabold text-foreground">
                    {workers.length} {workers.length === 1 ? "worker" : "workers"}
                </span>
            </div>

            <div className="mt-1.5 text-[13.5px] leading-[1.7] text-muted-foreground">
                <div>{format(localDay, "EEEE, MMMM d")}</div>
                <div>
                    {clock.start} – {clock.end}
                    {clock.zoneLabel ? (
                        <span
                            title={
                                clock.isViewerZone
                                    ? "Your timezone — this shift has none recorded"
                                    : primaryShift.timezone ?? undefined
                            }
                        >
                            {" "}
                            ({clock.zoneLabel}
                            {clock.isViewerZone ? "*" : ""})
                        </span>
                    ) : null}
                </div>
                <div>
                    {locationName || "Event"}
                    {primaryShift.locationAddress ? ` • ${primaryShift.locationAddress}` : ""}
                </div>
            </div>

            <hr className="my-3.5 border-t border-border" />

            <div className="flex flex-wrap items-center gap-2.5">
                <span
                    aria-hidden="true"
                    className={`h-5 w-[5px] shrink-0 rounded-full ${isFull ? "bg-emerald-500" : "bg-amber-500"}`}
                />
                <span className="text-[13.5px] font-semibold text-foreground">
                    {filled} of {total} filled
                </span>
                {overCapacityBy > 0 ? (
                    <span className="text-xs font-semibold text-amber-700">over capacity</span>
                ) : null}

                {workers.length > 0 ? (
                    <span className="ml-1 flex items-center">
                        {workers.slice(0, AVATAR_STACK_SIZE).map((worker, index) => {
                            const kind = worker.kind ?? "roster";
                            return (
                                <Avatar
                                    key={`${worker.id}-${index}`}
                                    className={`h-[30px] w-[30px] border-2 border-card ${index > 0 ? "-ml-[9px]" : ""}`}
                                    title={`${worker.name ?? worker.initials} — ${WORKER_KIND_NOUN[kind] ?? WORKER_KIND_NOUN.roster}`}
                                >
                                    <AvatarFallback className="bg-muted text-[11px] font-extrabold text-muted-foreground">
                                        {worker.initials}
                                    </AvatarFallback>
                                </Avatar>
                            );
                        })}
                        {workers.length > AVATAR_STACK_SIZE ? (
                            <span className="ml-2 text-[12.5px] font-bold text-muted-foreground">
                                +{workers.length - AVATAR_STACK_SIZE}
                            </span>
                        ) : null}
                    </span>
                ) : null}

                <span className="text-[13.5px] font-semibold text-primary group-hover:underline">
                    View all workers
                </span>

                {isUrgent && actionLabel ? (
                    <span className="ml-auto text-[13.5px] font-semibold text-primary group-hover:underline">
                        {actionLabel}
                    </span>
                ) : null}
            </div>
        </div>
    );
}
