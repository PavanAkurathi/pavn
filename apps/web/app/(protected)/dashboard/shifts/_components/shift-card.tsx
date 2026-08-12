import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { format, parseISO } from "date-fns";
import type { Shift } from "@/lib/types";
import { getShiftRoleTone } from "@/lib/shifts/role-theme";

interface ShiftCardProps {
    shifts: Shift[];
    onClick?: (shift: Shift) => void;
    isUrgent?: boolean;
    actionLabel?: string;
}

const SETTLED_STATUSES = ["completed", "approved", "cancelled"];
/** Open slots are listed individually, up to this many, then summarised. */
const MAX_OPEN_CHIPS = 3;

function filledOf(shift: Shift) {
    return shift.capacity?.filled ?? shift.assignedWorkers?.length ?? 0;
}

/**
 * One scheduled block, rendered as a row: when on the left, who on the right of
 * that, and where it stands on the far right.
 *
 * Each entry in `shifts` is a position within the same block — same time, same
 * location, different role — so the middle column lists them as
 * "role · filled/total · the people in it".
 */
export function ShiftCard({ shifts, onClick, isUrgent, actionLabel = "View Shift" }: ShiftCardProps) {
    if (!shifts || shifts.length === 0) return null;

    const primaryShift = shifts[0]!;
    const locationName = (primaryShift.locationName || "").trim();

    const startTime = parseISO(primaryShift.startTime);
    const endTime = parseISO(primaryShift.endTime);
    const durationHours = (endTime.getTime() - startTime.getTime()) / 3_600_000;

    const isSettled = SETTLED_STATUSES.includes(primaryShift.status);
    const openSlotCount = shifts.reduce(
        (sum, s) => sum + Math.max((s.capacity?.total ?? 0) - filledOf(s), 0),
        0,
    );
    const isUnderstaffed = openSlotCount > 0 && !isSettled;
    // More people assigned than the block has slots for. Nothing enforces
    // capacity server-side yet, so say so rather than calling it fully staffed.
    const overCapacityBy = shifts.reduce(
        (sum, s) => sum + Math.max(filledOf(s) - (s.capacity?.total ?? 0), 0),
        0,
    );
    const isPublished = ["published", "assigned", "in-progress"].includes(primaryShift.status);

    // Viewer's timezone abbreviation. The design shows the *location's* zone;
    // shift.timezone is not yet populated, so this stays honest about whose
    // clock is being shown until it is.
    const timeZoneLabel = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
        .formatToParts(startTime)
        .find((part) => part.type === "timeZoneName")?.value;

    const handleClick = (e?: React.MouseEvent | React.KeyboardEvent) => {
        e?.stopPropagation();
        if (onClick) onClick(primaryShift);
    };

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`View shift at ${locationName || "location"} on ${format(startTime, "EEEE, MMMM d")}`}
            className={`group grid cursor-pointer grid-cols-1 items-start gap-4 rounded-xl border bg-card p-3.5 shadow-sm transition-[box-shadow,border-color] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[9.5rem_minmax(0,1fr)_11rem] ${isUrgent
                ? "border-l-4 border-l-primary bg-primary/5"
                : isUnderstaffed
                    ? "border-destructive/40 hover:border-destructive/60"
                    : "border-border hover:border-border/90"
                }`}
            onClick={handleClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClick(e);
                }
            }}
        >
            {/* WHEN */}
            <div className="min-w-0">
                <div className="text-sm font-semibold tabular-nums leading-tight text-foreground">
                    {format(startTime, "h:mm a")} – {format(endTime, "h:mm a")}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {timeZoneLabel ? <span className="font-semibold">{timeZoneLabel}</span> : null}
                    <span aria-hidden="true" className="text-muted-foreground/50">·</span>
                    <span className="tabular-nums">{durationHours.toFixed(1)} h</span>
                </div>
            </div>

            {/* WHO */}
            <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold leading-tight text-foreground">
                        {locationName || "Event"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground/80">
                        {primaryShift.locationAddress}
                    </span>
                </div>

                <div className="flex flex-col gap-1.5">
                    {shifts.map((shift) => {
                        const total = shift.capacity?.total ?? 0;
                        const filled = filledOf(shift);
                        const open = Math.max(total - filled, 0);
                        const tone = getShiftRoleTone(shift.title);
                        const workers = shift.assignedWorkers ?? [];

                        return (
                            <div
                                key={shift.id}
                                className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2.5 md:grid-cols-[8.5rem_2.5rem_minmax(0,1fr)]"
                            >
                                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
                                    <span className="truncate">{shift.title}</span>
                                </span>

                                <span
                                    className={`text-xs font-semibold tabular-nums ${open > 0 && !isSettled ? "text-destructive" : "text-foreground"}`}
                                >
                                    {filled}/{total}
                                </span>

                                <div className="col-span-2 flex flex-wrap gap-1.5 md:col-span-1">
                                    {workers.map((worker, index) => (
                                        <span
                                            key={`${worker.id}-${index}`}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-0.5 pl-0.5 pr-2.5"
                                        >
                                            <Avatar className="h-[18px] w-[18px]">
                                                <AvatarImage src={worker.avatarUrl} />
                                                <AvatarFallback className="bg-muted text-[8px] font-semibold text-muted-foreground">
                                                    {worker.initials}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs text-foreground/80">
                                                {worker.name ?? worker.initials}
                                            </span>
                                        </span>
                                    ))}

                                    {!isSettled &&
                                        Array.from({ length: Math.min(open, MAX_OPEN_CHIPS) }).map((_, index) => (
                                            <span
                                                key={`open-${index}`}
                                                className="inline-flex items-center gap-1 rounded-full border border-dashed border-destructive/50 bg-destructive/5 px-2.5 py-0.5 text-xs font-semibold text-destructive"
                                            >
                                                Open slot
                                            </span>
                                        ))}

                                    {!isSettled && open > MAX_OPEN_CHIPS ? (
                                        <span className="inline-flex items-center px-1 text-xs font-semibold text-destructive">
                                            +{open - MAX_OPEN_CHIPS} more
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* WHERE IT STANDS */}
            <div className="flex flex-row flex-wrap items-center gap-1.5 md:flex-col md:items-end">
                {isUnderstaffed ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] font-semibold text-destructive">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        Needs cover · {openSlotCount}
                    </span>
                ) : overCapacityBy > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Over capacity · {overCapacityBy}
                    </span>
                ) : (
                    <span className="rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                        Fully staffed
                    </span>
                )}

                {isPublished ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Published
                    </span>
                ) : (
                    <span className="rounded-md border border-dashed border-border px-2 py-1 text-[11px] font-medium text-muted-foreground">
                        {primaryShift.status === "draft" ? "Draft" : primaryShift.status}
                    </span>
                )}

                <span
                    aria-hidden="true"
                    className="text-[11px] font-semibold text-muted-foreground transition-colors group-hover:text-primary group-hover:underline md:mt-0.5"
                >
                    {actionLabel}
                </span>
            </div>
        </div>
    );
}
