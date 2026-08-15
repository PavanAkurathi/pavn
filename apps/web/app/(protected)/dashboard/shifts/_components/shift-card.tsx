import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { format, parseISO } from "date-fns";
import type { Shift } from "@/lib/types";
import { getShiftRoleTone } from "@/lib/shifts/role-theme";
import { getShiftClock } from "@/lib/shifts/shift-time";

interface ShiftCardProps {
    shifts: Shift[];
    onClick?: (shift: Shift) => void;
    isUrgent?: boolean;
    actionLabel?: string;
}

const SETTLED_STATUSES = ["completed", "approved", "cancelled"];
/**
 * How many faces the avatar lane holds without growing.
 *
 * The card is a fixed size. A shift with six workers and a shift with sixty
 * have to occupy exactly the same space, or a busy week turns into a wall of
 * different-sized cards you cannot scan. This many avatars fit the lane; past
 * it the lane ends in an ellipsis and the rest of the story is one click away.
 */
const AVATAR_LANE_CAPACITY = 6;

/**
 * Same rule vertically. A block with fifteen roles in it would otherwise grow
 * a card fifteen rows tall; past this the card says how many roles are left
 * rather than listing them.
 */
const MAX_POSITION_ROWS = 4;

/**
 * The three kinds behave differently on the day: a roster worker clocks
 * themselves in, an invited one may never turn up because they never accepted,
 * and an agency worker is tracked entirely by the manager. Carried as a ring
 * colour rather than a text label, because text changes the card's width and
 * a ring does not.
 */
const WORKER_KIND_RING = {
    roster: "ring-border",
    invited: "ring-amber-400",
    agency: "ring-violet-400",
} as const;

const WORKER_KIND_NOUN = {
    roster: "on the roster",
    invited: "invited, not accepted yet",
    agency: "agency",
} as const;

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

    const clock = getShiftClock(startTime, endTime, primaryShift.timezone);

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
                    {clock.start} – {clock.end}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {clock.zoneLabel ? (
                        <span
                            className="font-semibold"
                            title={clock.isViewerZone ? "Your timezone — this shift has none recorded" : primaryShift.timezone ?? undefined}
                        >
                            {clock.zoneLabel}
                            {clock.isViewerZone ? "*" : ""}
                        </span>
                    ) : null}
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
                    {shifts.slice(0, MAX_POSITION_ROWS).map((shift) => {
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

                                {/* Fixed-height lane: the faces that fit, then an
                                    ellipsis. Never wraps, never grows. The faces
                                    are the part that yields when space runs out —
                                    the open-slot count must never be the thing
                                    that gets clipped off the end. */}
                                <div className="col-span-2 flex h-[22px] min-w-0 items-center gap-2 md:col-span-1">
                                    {workers.length > 0 ? (
                                        <span className="flex min-w-0 shrink -space-x-1.5 overflow-hidden">
                                            {workers.slice(0, AVATAR_LANE_CAPACITY).map((worker, index) => {
                                                const kind = worker.kind ?? "roster";
                                                return (
                                                    <Avatar
                                                        key={`${worker.id}-${index}`}
                                                        className={`h-[22px] w-[22px] shrink-0 ring-2 ${WORKER_KIND_RING[kind] ?? WORKER_KIND_RING.roster}`}
                                                        title={`${worker.name ?? worker.initials} — ${WORKER_KIND_NOUN[kind] ?? WORKER_KIND_NOUN.roster}`}
                                                    >
                                                        <AvatarImage src={worker.avatarUrl} />
                                                        <AvatarFallback className="bg-muted text-[8px] font-semibold text-muted-foreground">
                                                            {worker.initials}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                );
                                            })}
                                        </span>
                                    ) : null}

                                    {workers.length > AVATAR_LANE_CAPACITY ? (
                                        <span
                                            aria-label={`and ${workers.length - AVATAR_LANE_CAPACITY} more — open the shift to see everyone`}
                                            className="shrink-0 text-sm font-bold leading-none text-muted-foreground"
                                        >
                                            …
                                        </span>
                                    ) : null}

                                    {!isSettled && open > 0 ? (
                                        <span className="shrink-0 whitespace-nowrap rounded-full border border-dashed border-destructive/50 bg-destructive/5 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                                            {open} open
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}

                    {shifts.length > MAX_POSITION_ROWS ? (
                        <span className="flex h-[22px] items-center gap-1.5 text-xs text-muted-foreground">
                            <span aria-hidden="true" className="text-sm font-bold leading-none">…</span>
                            {shifts.length - MAX_POSITION_ROWS} more role
                            {shifts.length - MAX_POSITION_ROWS === 1 ? "" : "s"}
                        </span>
                    ) : null}
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
