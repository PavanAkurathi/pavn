// apps/web/components/shifts/shift-list.tsx 

import { ShiftCard } from "./shift-card";
import { Calendar, Loader2 } from "lucide-react";
import type { Shift } from "@/lib/types";
import {
    groupShiftsByDate,
    formatShiftDateLabel,
} from "@/lib/shifts/view-list";

interface ShiftListProps {
    shifts: Shift[];
    isLoading: boolean;
    onShiftClick?: (shift: Shift) => void;
    isUrgentList?: boolean;
}

export function ShiftList({ shifts, isLoading, onShiftClick, isUrgentList }: ShiftListProps) {
    const groupedShifts = groupShiftsByDate(shifts);
    const sortedDates = Object.keys(groupedShifts).sort();

    if (sortedDates.length === 0 && !isLoading) {
        return (
            <div className="py-16 text-center">
                <div className="mx-auto max-w-md">
                    <Calendar className="mx-auto mb-4 h-16 w-16 text-zinc-300" />
                    <h3 className="mb-3 text-xl font-semibold text-zinc-900">
                        No shifts found
                    </h3>
                    <p className="text-zinc-500">There are no shifts to display in this view.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {isLoading ? (
                <div className="text-center p-12">
                    <Loader2 className="animate-spin w-8 h-8 text-zinc-400 mx-auto" />
                </div>
            ) : (
                sortedDates.map((date) => (
                    <div key={date}>
                        <h3 className="mb-4 text-lg font-semibold text-zinc-500">
                            {formatShiftDateLabel(date)}
                        </h3>
                        <div className="space-y-3">
                            {groupedShifts[date]
                                ?.sort(
                                    (a, b) =>
                                        new Date(a.startTime).getTime() -
                                        new Date(b.startTime).getTime(),
                                )
                                .map((shift) => (
                                    <ShiftCard
                                        key={shift.id}
                                        shift={shift}
                                        onClick={() => onShiftClick?.(shift)}
                                        isUrgent={isUrgentList}
                                        actionLabel={isUrgentList ? "Review Timesheet" : undefined}
                                    />
                                ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
