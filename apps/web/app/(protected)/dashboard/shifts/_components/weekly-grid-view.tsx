"use client";

import { useMemo } from "react";
import { MapPin } from "lucide-react";

import { Badge } from "@repo/ui/components/ui/badge";
import { ScrollArea, ScrollBar } from "@repo/ui/components/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";

import type { Shift } from "@/lib/types";
import { buildWeeklyGridModel } from "@/lib/shifts/weekly-grid";

interface WeeklyGridViewProps {
    shifts: Shift[];
    weekStart: Date;
    onShiftClick?: (shift: Shift) => void;
}

const STATUS_STYLES: Record<string, string> = {
    published: "border-sky-200 bg-sky-50 text-sky-900",
    open: "border-amber-200 bg-amber-50 text-amber-900",
    assigned: "border-emerald-200 bg-emerald-50 text-emerald-900",
    "in-progress": "border-violet-200 bg-violet-50 text-violet-900",
};

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

export function WeeklyGridView({ shifts, weekStart, onShiftClick }: WeeklyGridViewProps) {
    const grid = useMemo(() => buildWeeklyGridModel(shifts, weekStart), [shifts, weekStart]);

    if (grid.sections.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
                <p className="text-lg font-semibold text-foreground">No published shifts for this week</p>
                <p className="mt-2 text-sm text-muted-foreground">
                    Try a different week or adjust your filters to find scheduled coverage.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border bg-card shadow-sm">
            <ScrollArea className="w-full">
                <div className="min-w-[1080px]">
                    <div className="grid grid-cols-[260px_repeat(7,minmax(130px,1fr))] border-b bg-muted/35">
                        <div className="border-r px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Location / Shift lane
                            </p>
                        </div>
                        {grid.days.map((day) => (
                            <div
                                key={day.dateKey}
                                className={cn(
                                    "border-r px-3 py-3 text-center last:border-r-0",
                                    day.isToday && "bg-accent/70",
                                )}
                            >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    {day.dayLabel}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-foreground">{day.shortDateLabel}</p>
                            </div>
                        ))}
                    </div>

                    {grid.sections.map((section) => (
                        <div key={section.id} className="border-b last:border-b-0">
                            <div className="flex items-center gap-2 border-b bg-background px-4 py-3">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <h3 className="text-sm font-semibold text-foreground">{section.locationName}</h3>
                            </div>

                            {section.lanes.map((lane) => (
                                <div
                                    key={lane.id}
                                    className="grid grid-cols-[260px_repeat(7,minmax(130px,1fr))] border-b last:border-b-0"
                                >
                                    <div className="border-r bg-background px-4 py-4">
                                        <p className="text-sm font-semibold text-foreground">{lane.title}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{lane.timeLabel}</p>
                                    </div>

                                    {lane.cells.map((cell) => (
                                        <div key={`${lane.id}-${cell.dateKey}`} className="min-h-[118px] border-r p-2 last:border-r-0">
                                            <div className="flex h-full flex-col gap-2">
                                                {cell.shifts.slice(0, 2).map((shift) => (
                                                    <button
                                                        key={shift.id}
                                                        type="button"
                                                        onClick={() => onShiftClick?.(shift)}
                                                        className={cn(
                                                            "rounded-xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                                                            STATUS_STYLES[shift.status] || "border-border bg-background text-foreground",
                                                        )}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">
                                                                Coverage
                                                            </p>
                                                            <Badge variant="outline" className="h-auto shrink-0 rounded-full border-current bg-transparent px-2 py-0.5 text-[10px] font-medium">
                                                                {renderStatusLabel(shift.status)}
                                                            </Badge>
                                                        </div>

                                                        <div className="mt-3">
                                                            <p className="text-base font-semibold">
                                                                {getFillSummary(shift).filled}/{getFillSummary(shift).total} filled
                                                            </p>
                                                            <p className="mt-1 text-xs opacity-80">
                                                                {getCoverageLabel(shift)}
                                                            </p>
                                                            <p className="mt-2 text-[11px] font-medium opacity-70">
                                                                Click for worker details
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}

                                                {cell.shifts.length > 2 ? (
                                                    <div className="rounded-lg border border-dashed px-2 py-1 text-[11px] font-medium text-muted-foreground">
                                                        +{cell.shifts.length - 2} more shift{cell.shifts.length - 2 === 1 ? "" : "s"}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}
