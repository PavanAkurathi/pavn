// apps/web/components/shifts/shift-list.tsx 

import { ShiftCard } from "./shift-card";
import { Calendar, Loader2 } from "lucide-react";
import type { Shift } from "@/lib/types";
import {
    groupShiftsByDate,
    formatShiftDateLabel,
    groupConcurrentShifts,
} from "@/lib/shifts/view-list";

const SETTLED_STATUSES = ["completed", "approved", "cancelled"];

/** Per-day totals shown beside the date, so gaps are visible before scrolling. */
function summariseDay(dayShifts: Shift[]) {
    let hours = 0;
    let openSlots = 0;

    for (const shift of dayShifts) {
        const total = shift.capacity?.total ?? 0;
        const filled = shift.capacity?.filled ?? shift.assignedWorkers?.length ?? 0;
        const duration =
            (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3_600_000;

        if (duration > 0) hours += duration * Math.max(total, 1);
        if (!SETTLED_STATUSES.includes(shift.status)) openSlots += Math.max(total - filled, 0);
    }

    return { hours: Math.round(hours), openSlots };
}

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
                    <Calendar aria-hidden="true" className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
                    <h3 className="mb-3 text-xl font-semibold text-foreground">
                        No shifts found
                    </h3>
                    <p className="text-muted-foreground">There are no shifts to display in this view.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {isLoading ? (
                <div className="text-center p-12" role="status" aria-live="polite">
                    <Loader2 aria-hidden="true" className="animate-spin w-8 h-8 text-muted-foreground mx-auto" />
                    <span className="sr-only">Loading shifts…</span>
                </div>
            ) : (
                sortedDates.map((date) => {
                    const dayShifts = groupedShifts[date] || [];
                    const blocks = groupConcurrentShifts(dayShifts).length;
                    const { hours, openSlots } = summariseDay(dayShifts);

                    return (
                    <div key={date}>
                        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h3 className="text-sm font-semibold text-foreground">
                                {formatShiftDateLabel(date)}
                            </h3>
                            <span className="text-xs tabular-nums text-muted-foreground">
                                {blocks} {blocks === 1 ? "shift" : "shifts"} · {hours} h
                            </span>
                            {openSlots > 0 ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive">
                                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                                    {openSlots} open {openSlots === 1 ? "slot" : "slots"}
                                </span>
                            ) : null}
                        </div>
                        <div className="space-y-3">

                            {groupConcurrentShifts(groupedShifts[date] || [])
                                .sort((a, b) => {
                                    const timeA = new Date(a[0]?.startTime ?? 0).getTime();
                                    const timeB = new Date(b[0]?.startTime ?? 0).getTime();
                                    return timeA - timeB;
                                })
                                .map((group) => {
                                    const firstShift = group[0];
                                    if (!firstShift) return null;
                                    return (
                                        <ShiftCard
                                            key={firstShift.id}
                                            shifts={group}
                                            onClick={(s) => onShiftClick?.(s)}
                                            isUrgent={isUrgentList}
                                            actionLabel={isUrgentList ? "Review Timesheet" : undefined}
                                        />
                                    );
                                })}
                        </div>
                    </div>
                    );
                })
            )}
        </div>
    );
}
