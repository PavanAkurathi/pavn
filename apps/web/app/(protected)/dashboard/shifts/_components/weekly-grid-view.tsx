"use client";

import { useMemo } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { cn } from "@repo/ui/lib/utils";

import type { Shift } from "@/lib/types";
import { buildWeeklyGridModel } from "@/lib/shifts/weekly-grid";
import { getShiftRoleTone } from "@/lib/shifts/role-theme";

interface WeeklyGridViewProps {
    shifts: Shift[];
    weekStart: Date;
    onShiftClick?: (shift: Shift) => void;
}

function getFillSummary(shift: Shift) {
    const filled = shift.capacity?.filled ?? shift.assignedWorkers?.length ?? 0;
    const total = shift.capacity?.total ?? shift.assignedWorkers?.length ?? 0;
    return { filled, total };
}

function DayRow({
    day,
    onShiftClick,
}: {
    day: ReturnType<typeof buildWeeklyGridModel>["days"][number];
    onShiftClick?: (shift: Shift) => void;
}) {
    const dayOpenSlots = day.events.reduce((sum, event) => {
        const { filled, total } = getFillSummary(event.shift);
        return sum + Math.max(total - filled, 0);
    }, 0);

    return (
        <div
            className={cn(
                "flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 sm:flex-row sm:items-start",
                day.isToday && "ring-1 ring-primary/20",
            )}
        >
            {/* Left rail: the day */}
            <div className="flex w-full shrink-0 items-center gap-3 sm:w-[132px] sm:flex-col sm:items-start sm:gap-1">
                <span
                    className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold sm:hidden",
                        day.isToday ? "bg-foreground text-background" : "bg-muted text-foreground",
                    )}
                >
                    {day.date.getDate()}
                </span>
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {day.dayLabel}
                    </p>
                    <p className={cn("mt-0.5 text-sm font-semibold", day.isToday ? "text-primary" : "text-foreground")}>
                        {day.shortDateLabel}
                    </p>
                </div>
                {dayOpenSlots > 0 && (
                    <p className="text-[11px] font-semibold text-destructive sm:mt-1">
                        {dayOpenSlots} open
                    </p>
                )}
            </div>

            {/* Right: shift strips flowing across, wrapping as needed */}
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {day.events.length > 0 ? (
                    day.events.map((event) => {
                        const { filled, total } = getFillSummary(event.shift);
                        const statusStyle = getShiftRoleTone(event.shift.title);
                        const isUnderstaffed = total > 0 && filled < total;
                        // A draft is on the calendar but not announced. Dashed
                        // edges say "not real yet" without hiding it.
                        const isDraft = event.shift.status === "draft";

                        return (
                            <button
                                key={event.id}
                                type="button"
                                onClick={() => onShiftClick?.(event.shift)}
                                aria-label={`${isDraft ? "Draft: " : ""}${event.shift.title}, ${event.timeLabel}, ${filled} of ${total} filled${isUnderstaffed ? `, ${total - filled} open` : ""}`}
                                className={cn(
                                    "group flex w-[172px] flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left ring-1 transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    statusStyle.surface,
                                    isUnderstaffed ? "ring-destructive/50" : "ring-border/40",
                                    isDraft && "border border-dashed border-amber-400 opacity-90 ring-0",
                                )}
                            >
                                <span className="flex items-center justify-between gap-1.5">
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", statusStyle.accent)} />
                                        <span className="truncate text-xs font-semibold">{event.shift.title}</span>
                                    </span>
                                    <span
                                        className={cn(
                                            "flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums",
                                            isUnderstaffed && "text-destructive",
                                        )}
                                    >
                                        {filled}/{total}
                                    </span>
                                </span>
                                <span className="flex items-center gap-1.5 pl-3.5 text-[11px] tabular-nums opacity-75">
                                    {event.timeLabel}
                                    {isDraft ? (
                                        <span className="rounded-sm bg-amber-100 px-1 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                                            Draft
                                        </span>
                                    ) : null}
                                </span>
                            </button>
                        );
                    })
                ) : (
                    <div className="flex h-9 flex-1 items-center rounded-lg bg-muted/35 px-3 text-[11px] text-muted-foreground">
                        No shifts
                    </div>
                )}
            </div>
        </div>
    );
}

export function WeeklyGridView({ shifts, weekStart, onShiftClick }: WeeklyGridViewProps) {
    const grid = useMemo(() => buildWeeklyGridModel(shifts, weekStart), [shifts, weekStart]);
    const totalShiftCount = grid.days.reduce((sum, day) => sum + day.events.length, 0);

    return (
        <div className="overflow-hidden rounded-[28px] border border-border/70 bg-muted/30 shadow-sm">
            <div className="flex items-center justify-between px-6 py-5">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Weekly calendar
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        One row per day — open slots pull the eye to the day that needs staffing.
                    </p>
                </div>
                <Badge variant="outline" className="w-fit rounded-full bg-background/80 px-3 py-1 text-xs font-medium">
                    {totalShiftCount} shift{totalShiftCount === 1 ? "" : "s"} this week
                </Badge>
            </div>

            <div className="flex flex-col gap-2 px-4 pb-4">
                {grid.days.map((day) => (
                    <DayRow key={day.dateKey} day={day} onShiftClick={onShiftClick} />
                ))}
            </div>
        </div>
    );
}
