import { ShiftCard } from "./shift-card";
import { Calendar, Loader2 } from "lucide-react";
import type { Shift } from "@/lib/types";
import {
    groupShiftsByDate,
    filterUpcomingDates,
    formatShiftDateLabel,
} from "@/lib/shifts/view-list";

interface ShiftListProps {
    shifts: Shift[];
    isLoading: boolean;
    onShiftClick?: (shift: Shift) => void;
}

export function ShiftList({ shifts, isLoading, onShiftClick }: ShiftListProps) {
    const groupedShifts = groupShiftsByDate(shifts);
    // Sort dates descending for past shifts/generic lists usually, but let's stick to ascending or check logic
    // Actually, for "Needs Approval" & "Past", descending (newest first) is usually better.
    // For "Upcoming", ascending (soonest first) is better.
    // BUT the passed shifts are already sorted by the Service/Parent. 
    // groupShiftsByDate loses order if object keys are iterated arbitrarily (though usually insertion order or numeric).
    // Let's sort keys properly.

    // Auto-detect sort direction? Or just default asc for now to match previous behavior?
    // Let's stick to ascending for consistency across lists unless asked otherwise.
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
                                    />
                                ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
