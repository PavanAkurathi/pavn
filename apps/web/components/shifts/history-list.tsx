import { ShiftCard } from "./shift-card";
import { ClipboardList, Loader2 } from "lucide-react";
import type { Shift } from "@/lib/types";
import {
    groupShiftsByDate,
    formatShiftDateLabel,
} from "@/lib/shifts/view-list";

interface HistoryListProps {
    shifts: Shift[];
    isLoading: boolean;
    onShiftClick?: (shift: Shift) => void;
}

export function HistoryList({ shifts, isLoading, onShiftClick }: HistoryListProps) {
    const groupedShifts = groupShiftsByDate(shifts);
    const sortedDates = Object.keys(groupedShifts).sort((a, b) =>
        // Sort history descending (newest first)
        new Date(b).getTime() - new Date(a).getTime()
    );

    if (shifts.length === 0 && !isLoading) {
        return (
            <div className="py-16 text-center">
                <div className="mx-auto max-w-md">
                    <ClipboardList className="mx-auto mb-4 h-16 w-16 text-zinc-300" />
                    <h3 className="mb-3 text-xl font-semibold text-zinc-900">
                        No history found
                    </h3>
                    <p className="text-zinc-500">Past shifts will appear here.</p>
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
                                        // Sort items within day descending as well for history
                                        new Date(b.startTime).getTime() -
                                        new Date(a.startTime).getTime(),
                                )
                                .map((shift) => (
                                    <ShiftCard
                                        key={shift.id}
                                        shift={shift}
                                        onClick={() => onShiftClick?.(shift)}
                                    // For history, we might want to show status clearly
                                    />
                                ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
