import { Card } from "@repo/ui/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { format, parseISO } from "date-fns";
import { Shift } from "../../lib/types";

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

    // Helper for deterministic role colors using semantic tokens
    const getRoleColor = (role: string) => {
        const lowerRole = role.toLowerCase();
        if (lowerRole.includes("server")) return { bg: "bg-role-server", ring: "ring-role-server" };
        if (lowerRole.includes("bartender")) return { bg: "bg-role-bartender", ring: "ring-role-bartender" };
        if (lowerRole.includes("kitchen") || lowerRole.includes("chef") || lowerRole.includes("cook")) return { bg: "bg-role-kitchen", ring: "ring-role-kitchen" };
        if (lowerRole.includes("host")) return { bg: "bg-role-host", ring: "ring-role-host" };
        if (lowerRole.includes("busser") || lowerRole.includes("runner")) return { bg: "bg-role-support", ring: "ring-role-support" };
        return { bg: "bg-role-default", ring: "ring-role-default" };
    };

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
            className={`cursor-pointer transition-all hover:shadow-md overflow-hidden bg-white group ${isUrgent
                ? "border-l-4 border-l-red-500 bg-red-50/10"
                : "border-zinc-200 hover:border-zinc-300"
                }`}
            onClick={handleClick}
        >
            {/* Main Content Area: Flex Row for Side-by-Side Layout */}
            <div className="p-5 flex justify-between items-start gap-4">

                {/* LEFT COLUMN: Event Details */}
                <div className="flex flex-col gap-1 flex-1">
                    <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg text-zinc-900 leading-tight">
                            {locationName || "Event"}
                        </h3>
                        {/* Optional: Status Badges */}
                        {isUrgent && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full tracking-wide">
                                ACTION REQUIRED
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col text-sm text-zinc-500 font-medium mt-1">
                        <span>{format(startTime, "EEEE, MMMM d")}</span>
                        <span>{format(startTime, "hh:mm a")} - {format(endTime, "hh:mm a")} (EDT)</span>
                    </div>

                    {/* Address Line (Roles removed) */}
                    <div className="text-sm text-zinc-500 mt-2 opacity-90">
                        {primaryShift.locationAddress || locationName}
                    </div>
                </div>

                {/* RIGHT COLUMN: Roles List with Colors */}
                <div className="flex flex-col items-end gap-1 shrink-0 pt-1">
                    {roleBreakdown.map((item) => {
                        const color = getRoleColor(item.role);
                        return (
                            <div key={item.role} className="text-xs text-zinc-500 font-medium flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${color.bg}`} />
                                <span>{item.role}: {item.count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer: Workers & Action */}
            <div className="bg-zinc-50/50 border-t border-zinc-100 px-5 py-3 flex items-center justify-between">

                {/* Left: Avatars - Styled with rings matching their role */}
                <div className="flex items-center gap-3">
                    {allAssignedWorkers.length > 0 ? (
                        <div className="flex -space-x-2">
                            {allAssignedWorkers.slice(0, 5).map((worker, i) => {
                                // Add index to key to avoid duplicates if same worker assigned multiple times (edge case)
                                const color = getRoleColor(worker.role);
                                return (
                                    <Avatar key={`${worker.id}-${i}`} className={`w-8 h-8 border-2 border-white ring-2 ${color.ring} ring-offset-0`}>
                                        <AvatarImage src={worker.avatarUrl} />
                                        <AvatarFallback className="text-[9px] bg-zinc-100 text-zinc-600 font-bold border border-zinc-200">
                                            {worker.initials}
                                        </AvatarFallback>
                                    </Avatar>
                                );
                            })}
                            {allAssignedWorkers.length > 5 && (
                                <div className="w-8 h-8 rounded-full bg-zinc-50 border-2 border-white ring-2 ring-zinc-200 flex items-center justify-center text-[9px] text-zinc-500 font-bold">
                                    +{allAssignedWorkers.length - 5}
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="text-sm text-zinc-400 italic">No pros assigned</span>
                    )}
                </div>

                {/* Right: Action Link (Neutral Theme) */}
                <button
                    className="text-sm font-bold text-zinc-700 hover:text-zinc-900 hover:underline flex items-center gap-1 transition-colors"
                    onClick={handleClick}
                >
                    {actionLabel}
                </button>
            </div>
        </Card>
    );
}
