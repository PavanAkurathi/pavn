"use client";

import { useMemo } from "react";
import { CalendarDays, Clock3, MapPin, Users } from "lucide-react";

import { Badge } from "@repo/ui/components/ui/badge";
import { ScrollArea, ScrollBar } from "@repo/ui/components/ui/scroll-area";
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

function getCoverageLabel(shift: Shift) {
    const { filled, total } = getFillSummary(shift);

    if (total === 0) {
        return "No staffing target";
    }

    if (filled >= total) {
        return "Fully staffed";
    }

    if (filled === 0) {
        return `${total} open slot${total === 1 ? "" : "s"}`;
    }

    const open = total - filled;
    return `${open} open slot${open === 1 ? "" : "s"}`;
}

function renderStatusLabel(status: Shift["status"]) {
    if (status === "in-progress") {
        return "In Progress";
    }

    return status.charAt(0).toUpperCase() + status.slice(1);
}

function DayColumn({
    day,
    onShiftClick,
}: {
    day: ReturnType<typeof buildWeeklyGridModel>["days"][number];
    onShiftClick?: (shift: Shift) => void;
}) {
    return (
        <div
            className={cn(
                "flex min-h-[320px] flex-col rounded-2xl border border-border/70 bg-card p-3 shadow-sm",
                day.isToday && "ring-1 ring-primary/20",
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {day.dayLabel}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                        {day.shortDateLabel}
                    </p>
                </div>
                <span
                    className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                        day.isToday ? "bg-foreground text-background" : "bg-muted text-foreground",
                    )}
                >
                    {day.date.getDate()}
                </span>
            </div>

            <div className="mt-4 flex flex-1 flex-col gap-3">
                {day.events.length > 0 ? (
                    day.events.map((event) => {
                        const { filled, total } = getFillSummary(event.shift);
                        const statusStyle = getShiftRoleTone(event.shift.title);

                        return (
                            <button
                                key={event.id}
                                type="button"
                                onClick={() => onShiftClick?.(event.shift)}
                                className={cn(
                                    "group relative overflow-hidden rounded-2xl border border-transparent text-left shadow-sm ring-1 ring-border/40 transition hover:-translate-y-0.5 hover:shadow-md",
                                    statusStyle.surface,
                                )}
                            >
                                <div className={cn("absolute inset-x-0 top-0 h-1.5", statusStyle.accent)} />
                                <div className="flex flex-col gap-3 px-3 py-3.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">
                                                {event.shift.title}
                                            </p>
                                            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium opacity-75">
                                                <Clock3 className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">{event.timeLabel}</span>
                                            </div>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="h-auto shrink-0 rounded-full border-current bg-transparent px-2 py-0.5 text-[10px] font-medium"
                                        >
                                            {renderStatusLabel(event.shift.status)}
                                        </Badge>
                                    </div>

                                    <div className="flex flex-col gap-1.5 text-[11px] opacity-85">
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">{event.locationName}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Users className="h-3.5 w-3.5 shrink-0" />
                                            <span>
                                                {filled}/{total} filled · {getCoverageLabel(event.shift)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })
                ) : (
                    <div className="flex flex-1 rounded-2xl bg-muted/35" />
                )}
            </div>
        </div>
    );
}

function WeekHeader({
    days,
}: {
    days: ReturnType<typeof buildWeeklyGridModel>["days"];
}) {
    return (
        <div className="grid grid-cols-7 gap-3 px-4 pb-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {days.map((day) => (
                <div key={day.dateKey} className="py-1">
                    {day.dayLabel}
                </div>
            ))}
        </div>
    );
}

function EmptyWeekGrid({
    days,
}: {
    days: ReturnType<typeof buildWeeklyGridModel>["days"];
}) {
    return (
        <div className="grid grid-cols-7 gap-3 px-4 pb-4">
            {days.map((day) => (
                <div
                    key={day.dateKey}
                    className="flex min-h-[180px] flex-col rounded-2xl border border-border/70 bg-card p-3"
                >
                    <span
                        className={cn(
                            "text-sm font-semibold",
                            day.isToday ? "text-primary" : "text-foreground",
                        )}
                    >
                        {day.date.getDate()}
                    </span>
                    <div className="mt-3 flex flex-1 rounded-2xl bg-muted/35" />
                </div>
            ))}
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
                        Published shifts laid out in a simple weekly board.
                    </p>
                </div>
                <Badge variant="outline" className="w-fit rounded-full bg-background/80 px-3 py-1 text-xs font-medium">
                    {totalShiftCount} shift{totalShiftCount === 1 ? "" : "s"} this week
                </Badge>
            </div>

            <WeekHeader days={grid.days} />

            <ScrollArea className="w-full">
                <div className="min-w-[1120px]">
                    {totalShiftCount === 0 ? (
                        <EmptyWeekGrid days={grid.days} />
                    ) : (
                        <div className="grid grid-cols-7 gap-3 px-4 pb-4">
                            {grid.days.map((day) => (
                                <DayColumn key={day.dateKey} day={day} onShiftClick={onShiftClick} />
                            ))}
                        </div>
                    )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}
