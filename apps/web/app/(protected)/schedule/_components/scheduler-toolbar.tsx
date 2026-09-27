"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import type { SchedulerWeek } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { cn } from "@repo/ui/lib/utils";
import { weekRangeLabel } from "@/lib/scheduler/format";
import { ALL_DEPARTMENTS, type ViewMode } from "@/lib/scheduler/view-model";
import { getDashboardShiftsHref } from "@/lib/routes";

export function SchedulerToolbar({
    week,
    locations,
    locationId,
    onLocation,
    onWeek,
    onThisWeek,
    department,
    onDepartment,
    viewMode,
    onViewMode,
    onOpenCounter,
    onHelp,
    busy,
}: {
    week: SchedulerWeek;
    locations: { id: string; name: string }[];
    locationId: string;
    onLocation: (id: string) => void;
    onWeek: (step: -1 | 1) => void;
    onThisWeek: () => void;
    department: string;
    onDepartment: (id: string) => void;
    viewMode: ViewMode;
    onViewMode: (mode: ViewMode) => void;
    onOpenCounter: () => void;
    onHelp: () => void;
    busy: boolean;
}) {
    const isThisWeek = week.days.some((d) => d.isToday);
    const today = week.days.find((d) => d.isToday)?.localDate;
    const { openSlots, pendingChangeCount, pendingRequestCount } = week.summary;

    return (
        <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="sr-only">Schedule</h1>

            {locations.length > 1 ? (
                <Select value={locationId} onValueChange={onLocation}>
                    <SelectTrigger aria-label="Location" className="h-9 w-auto min-w-40 font-semibold">
                        {/* Children, so the name shows before the menu has ever opened. */}
                        <SelectValue>{week.location.name}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {locations.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                                {l.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : (
                <span className="px-1 text-[15px] font-semibold">{week.location.name}</span>
            )}

            <div className="flex h-9 items-center gap-0.5 rounded-md border bg-card px-0.5">
                <Button variant="ghost" size="icon" className="size-8" aria-label="Previous week" onClick={() => onWeek(-1)}>
                    <ChevronLeft />
                </Button>
                <span
                    aria-live="polite"
                    className={cn("min-w-32 text-center text-[13.5px] font-semibold tabular-nums", busy && "opacity-60")}
                >
                    {weekRangeLabel(week.days[0]!.localDate, week.days[6]!.localDate, today ?? week.days[0]!.localDate)}
                </span>
                <Button variant="ghost" size="icon" className="size-8" aria-label="Next week" onClick={() => onWeek(1)}>
                    <ChevronRight />
                </Button>
            </div>
            {isThisWeek ? null : (
                <Button variant="outline" size="sm" className="h-9" onClick={onThisWeek}>
                    This week
                </Button>
            )}

            {week.departments.length > 1 ? (
                <div
                    role="group"
                    aria-label="Department"
                    className="flex h-9 max-w-full items-center gap-0.5 overflow-x-auto rounded-md border bg-muted p-0.5"
                >
                    {[{ id: ALL_DEPARTMENTS, name: "All" }, ...week.departments].map((d) => (
                        <button
                            key={d.id}
                            type="button"
                            aria-pressed={department === d.id}
                            onClick={() => onDepartment(d.id)}
                            className={cn(
                                "h-full whitespace-nowrap rounded px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground",
                                department === d.id && "bg-card text-foreground shadow-sm",
                            )}
                        >
                            {d.name}
                        </button>
                    ))}
                </div>
            ) : null}

            <div className="ml-auto flex flex-wrap items-center gap-2">
                {openSlots > 0 ? (
                    <button
                        type="button"
                        onClick={onOpenCounter}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[13.5px] font-semibold text-destructive hover:bg-muted"
                    >
                        <span aria-hidden className="size-2 rounded-full bg-current" />
                        {openSlots} open
                    </button>
                ) : null}
                {pendingRequestCount > 0 ? (
                    <span className="inline-flex h-9 items-center px-2 text-[13.5px] font-semibold text-foreground/80">
                        {pendingRequestCount} {pendingRequestCount === 1 ? "request" : "requests"}
                    </span>
                ) : null}
                {pendingChangeCount > 0 ? (
                    <Button asChild variant="outline" size="sm" className="h-9">
                        <Link href={getDashboardShiftsHref()}>
                            {pendingChangeCount} unpublished · Review
                        </Link>
                    </Button>
                ) : null}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="size-9" aria-label="More">
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>View by</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={viewMode} onValueChange={(v) => onViewMode(v as ViewMode)}>
                            <DropdownMenuRadioItem value="people">People</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="positions">Positions</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/settings/scheduling">Scheduling settings</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={onHelp}>What the markings mean</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
