import { ShiftCard } from "./shift-card";
import { History, Loader2 } from "lucide-react";
import type { Shift } from "@/lib/types";
import {
    groupShiftsByDate,
    filterPastDates,
    formatShiftDateLabel,
} from "@/lib/shifts/view-list";

interface HistoryListProps {
    shifts: Shift[];
    isLoading: boolean;
    onShiftClick?: (shift: Shift) => void;
}

export function HistoryList({ shifts, isLoading, onShiftClick }: HistoryListProps) {
    const groupedShifts = groupShiftsByDate(shifts);
    const sortedDates = Object.keys(groupedShifts).sort((a, b) => b.localeCompare(a)); // Descending order for history
    const pastDates = filterPastDates(sortedDates);

    if (pastDates.length === 0 && !isLoading) {
        return (
            <div className="py-16 text-center">
                <div className="mx-auto max-w-md">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                        <History className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="mb-3 text-xl font-semibold text-zinc-900">
                        No shift history
                    </h3>
                    <p className="text-zinc-500">Completed and approved shifts will appear here.</p>
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
                pastDates.map((date) => (
                    <div key={date}>
                        <h3 className="mb-4 text-lg font-semibold text-zinc-500">
                            {formatShiftDateLabel(date)}
                        </h3>
                        <div className="space-y-3">
                            {groupedShifts[date]
                                ?.sort(
                                    (a, b) =>
                                        new Date(b.startTime).getTime() -
                                        new Date(a.startTime).getTime(),
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
