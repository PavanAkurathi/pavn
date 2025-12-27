// apps/web/components/shifts/shift-card.tsx

"use client";

import { Card } from "@repo/ui/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { format, parseISO } from "date-fns";
import { Shift } from "../../lib/types";

interface ShiftCardProps {
    shift: Shift;
    onClick?: () => void;
    isUrgent?: boolean;
    actionLabel?: string;
}

export function ShiftCard({ shift, onClick, isUrgent, actionLabel = "View all Pros" }: ShiftCardProps) {
    const startTime = parseISO(shift.startTime);
    const endTime = parseISO(shift.endTime);

    const filledCount = shift.capacity?.filled || 0;
    const totalCapacity = shift.capacity?.total || 0;
    const percentFilled = totalCapacity > 0 ? (filledCount / totalCapacity) * 100 : 0;
    const remainingSlots = totalCapacity - filledCount;

    return (
        <Card
            className={`cursor-pointer transition-all hover:shadow-sm ${isUrgent
                ? "border-l-4 border-l-red-500 bg-red-50/30 border-t-zinc-200 border-r-zinc-200 border-b-zinc-200 hover:bg-red-50/50"
                : "border-zinc-200 hover:border-zinc-400"
                }`}
            onClick={onClick}
        >
            <div className="p-4 flex flex-col gap-3">

                {/* Header Section */}
                <div className="space-y-1">
                    <div className="flex justify-between items-start">
                        <h3 className="font-bold text-base text-zinc-900 leading-tight">
                            {shift.locationName}
                        </h3>
                        {isUrgent && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full tracking-wide">
                                ACTION REQUIRED
                            </span>
                        )}
                    </div>

                    <div className="space-y-1 pt-1">
                        <p className="text-sm font-medium text-zinc-500">
                            {format(startTime, "EEEE, MMMM d")}
                        </p>
                        <p className="text-sm text-zinc-500">
                            {format(startTime, "hh:mm a")} - {format(endTime, "hh:mm a")}
                            {/* Timezone abbreviation would go here if available, e.g. (EDT) */}
                        </p>
                    </div>

                    <p className="text-sm text-zinc-500 pt-1">
                        {shift.locationAddress || "Main Hall"} • {shift.title}
                    </p>
                </div>

                {/* Divider */}
                <div className="h-px bg-zinc-100" />

                {/* Footer / Workers Section */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Avatars */}
                        {shift.assignedWorkers && shift.assignedWorkers.length > 0 ? (
                            <div className="flex items-center gap-2">
                                <div className="flex -space-x-2">
                                    {shift.assignedWorkers.slice(0, 3).map((worker) => (
                                        <Avatar key={worker.id} className="w-6 h-6 border-2 border-white ring-0">
                                            <AvatarImage src={worker.avatarUrl} />
                                            <AvatarFallback className="text-[9px] bg-zinc-200 text-zinc-600 font-bold">
                                                {worker.initials}
                                            </AvatarFallback>
                                        </Avatar>
                                    ))}
                                </div>
                                <span className="text-sm text-zinc-500 font-medium">
                                    {shift.assignedWorkers.length} assigned
                                </span>
                            </div>
                        ) : (
                            <span className="text-sm text-zinc-400 font-medium">
                                No workers assigned
                            </span>
                        )}
                    </div>

                    {/* Link */}
                    <span className={`text-sm font-medium hover:underline ${isUrgent ? "text-red-600" : "text-primary"}`}>
                        {actionLabel}
                    </span>
                </div>
            </div>
        </Card>
    );
}

