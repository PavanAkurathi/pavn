import { Card } from "@repo/ui/components/ui/card";
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

export function ShiftCard({ shifts, onClick, isUrgent, actionLabel = "View Shift" }: ShiftCardProps) {
    if (!shifts || shifts.length === 0) return null;

    const primaryShift = shifts[0]!;
    const locationName = (primaryShift.locationName || "").trim();

    const startTime = parseISO(primaryShift.startTime);
    const endTime = parseISO(primaryShift.endTime);

    // Understaffed shifts get the red bulb: open slots on a shift that can
    // still be staffed. Settled shifts (approved/cancelled/completed) stay calm.
    const openSlotCount = shifts.reduce((sum, s) => {
        const total = s.capacity?.total ?? 0;
        const filled = s.capacity?.filled ?? s.assignedWorkers?.length ?? 0;
        return sum + Math.max(total - filled, 0);
    }, 0);
    const isSettled = ["completed", "approved", "cancelled"].includes(primaryShift.status);
    const isUnderstaffed = openSlotCount > 0 && !isSettled;
    // Viewer's timezone abbreviation (e.g. "PDT") — honest until shifts are
    // anchored to the location's timezone.
    const timeZoneLabel = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
        .formatToParts(startTime)
        .find((part) => part.type === "timeZoneName")?.value;

    // Workers with Role Context for coloring
    // We map over shifts to get workers and assign them the role of that shift
    const allAssignedWorkers = shifts.flatMap(s =>
        (s.assignedWorkers || []).map(w => ({ ...w, role: s.title }))
    );

    // Calculate Role Breakdown for vertical display
    const roleCounts: Record<string, number> = {};
    shifts.forEach(s => {
        const count = s.capacity?.total || 0;
        roleCounts[s.title] = (roleCounts[s.title] || 0) + count;
    });

    const roleBreakdown = Object.entries(roleCounts).map(([role, count]) => ({ role, count }));

    const handleClick = (e?: React.MouseEvent | React.KeyboardEvent) => {
        e?.stopPropagation();
        if (onClick) onClick(primaryShift);
    };

    return (
        <Card
            role="button"
            tabIndex={0}
            aria-label={`View shift at ${locationName || "location"} on ${format(startTime, "EEEE, MMMM d")}`}
            className={`group cursor-pointer overflow-hidden transition-[box-shadow,border-color] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isUrgent
                ? "border-l-4 border-l-primary bg-primary/5"
                : isUnderstaffed
                    ? "border-destructive/50 bg-card hover:border-destructive/70"
                    : "border-border bg-card hover:border-border/90"
                }`}
            onClick={handleClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClick(e);
                }
            }}
        >
            {/* Main Content Area: Flex Row for Side-by-Side Layout */}
            <div className="p-5 flex justify-between items-start gap-4">

                {/* LEFT COLUMN: Event Details */}
                <div className="flex flex-col gap-1 flex-1">
                    <div className="flex justify-between items-start">
                        <h3 className="text-lg font-bold leading-tight text-foreground">
                            {locationName || "Event"}
                        </h3>
                        {/* Optional: Status Badges */}
                        {isUrgent && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary">
                                ACTION REQUIRED
                            </span>
                        )}
                    </div>

                    <div className="mt-1 text-sm font-medium text-muted-foreground">
                        {format(startTime, "h:mm a")} – {format(endTime, "h:mm a")}
                        {timeZoneLabel ? ` (${timeZoneLabel})` : ""}
                    </div>

                    <div className="mt-1 max-w-xl truncate text-sm text-muted-foreground opacity-90">
                        {primaryShift.locationAddress || locationName}
                    </div>
                </div>

                {/* RIGHT COLUMN: Roles List with Colors */}
                <div className="flex flex-col items-end gap-1 shrink-0 pt-1">
                    {roleBreakdown.map((item) => {
                        const color = getShiftRoleTone(item.role);
                        return (
                            <div key={item.role} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                                <span>{item.role}: {item.count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer: Workers & Action */}
            <div className="flex items-center justify-between border-t border-border/70 bg-muted/40 px-5 py-3">

                {/* Left: Avatars - Styled with rings matching their role */}
                <div className="flex items-center gap-3">
                    {allAssignedWorkers.length > 0 ? (
                        <div className="flex -space-x-2">
                            {allAssignedWorkers.slice(0, 5).map((worker, i) => {
                                // Add index to key to avoid duplicates if same worker assigned multiple times (edge case)
                                const color = getShiftRoleTone(worker.role);
                                return (
                                    <Avatar key={`${worker.id}-${i}`} className={`w-8 h-8 border-2 border-background ring-2 ${color.ring} ring-offset-0`}>
                                        <AvatarImage src={worker.avatarUrl} />
                                        <AvatarFallback className="border border-border bg-muted text-[9px] font-bold text-muted-foreground">
                                            {worker.initials}
                                        </AvatarFallback>
                                    </Avatar>
                                );
                            })}
                            {allAssignedWorkers.length > 5 && (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-background text-[9px] font-bold text-muted-foreground ring-2 ring-border">
                                    +{allAssignedWorkers.length - 5}
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className={`text-sm font-medium ${isUnderstaffed ? "text-destructive" : "text-muted-foreground"}`}>
                            {(() => {
                                const totalCap = shifts.reduce((sum, s) => sum + (s.capacity?.total ?? 0), 0);
                                return totalCap > 0 ? `0 of ${totalCap} filled` : "No workers assigned";
                            })()}
                        </span>
                    )}
                </div>

                {/* Right: Action Link (Neutral Theme) */}
                <span
                    aria-hidden="true"
                    className="flex items-center gap-1 text-sm font-bold text-foreground transition-colors group-hover:text-primary group-hover:underline"
                >
                    {actionLabel}
                </span>
            </div>
        </Card>
    );
}
