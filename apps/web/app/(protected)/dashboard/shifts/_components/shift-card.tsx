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

export function ShiftCard({ shifts, onClick, isUrgent, actionLabel = "View all Pros" }: ShiftCardProps) {
    if (!shifts || shifts.length === 0) return null;

    const primaryShift = shifts[0]!;
    // Use location name as the main "Event Title", cleaning up undesired suffixes
    const rawName = primaryShift.locationName || "";
    // Remove "A Longwood Venue" with optional colon/hyphen prefix, case insensitive
    const locationName = rawName.replace(/[:|-]?\s*A Longwood Venue/i, "").trim();

    const startTime = parseISO(primaryShift.startTime);
    const endTime = parseISO(primaryShift.endTime);

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

    // Click handler
    const handleClick = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (onClick) onClick(primaryShift);
    };

    return (
        <Card
            className={`group cursor-pointer overflow-hidden transition-all hover:shadow-md ${isUrgent
                ? "border-l-4 border-l-primary bg-primary/5"
                : "border-border bg-card hover:border-border/90"
                }`}
            onClick={handleClick}
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

                    <div className="mt-1 flex flex-col text-sm font-medium text-muted-foreground">
                        <span>{format(startTime, "EEEE, MMMM d")}</span>
                        <span>{format(startTime, "hh:mm a")} - {format(endTime, "hh:mm a")} (EDT)</span>
                    </div>

                    {/* Address Line (Roles removed) */}
                    <div className="mt-2 text-sm text-muted-foreground opacity-90">
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
                                    <Avatar key={`${worker.id}-${i}`} className={`w-8 h-8 border-2 border-white ring-2 ${color.ring} ring-offset-0`}>
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
                        <span className="text-sm italic text-muted-foreground">No pros assigned</span>
                    )}
                </div>

                {/* Right: Action Link (Neutral Theme) */}
                <button
                    className="flex items-center gap-1 text-sm font-bold text-foreground transition-colors hover:text-primary hover:underline"
                    onClick={handleClick}
                >
                    {actionLabel}
                </button>
            </div>
        </Card>
    );
}
