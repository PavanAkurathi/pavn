"use client";

import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, MoreHorizontal, Plus, Redo2, Search, Undo2 } from "lucide-react";
import type { SchedulerWeek } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { cn } from "@repo/ui/lib/utils";
import { weekRangeLabel } from "@/lib/scheduler/format";
import { ALL_DEPARTMENTS } from "@/lib/scheduler/view-model";

export type Layout = "day" | "week";

/** Everything above the days: where, which week, day or week, and the one thing you do most: add a shift. */
export function ScheduleHeader({
    week,
    locations,
    locationId,
    onLocation,
    onWeek,
    onToday,
    showToday,
    layout,
    onLayout,
    department,
    onDepartment,
    search,
    onSearch,
    onAddShift,
    busy,
    history,
    onCopyWeek,
    onTemplate,
    onAddEvent,
    onRequests,
    onDiscard,
    onHelp,
}: {
    week: SchedulerWeek;
    locations: { id: string; name: string }[];
    locationId: string;
    onLocation: (id: string) => void;
    onWeek: (step: -1 | 1) => void;
    onToday: () => void;
    showToday: boolean;
    layout: Layout;
    onLayout: (layout: Layout) => void;
    department: string;
    onDepartment: (id: string) => void;
    search: string;
    onSearch: (value: string) => void;
    onAddShift: () => void;
    busy: boolean;
    history: { canUndo: boolean; canRedo: boolean; undoLabel?: string; onUndo: () => void; onRedo: () => void };
    onCopyWeek: () => void;
    onTemplate: () => void;
    onAddEvent: () => void;
    onRequests: () => void;
    onDiscard: () => void;
    onHelp: () => void;
}) {
    const today = week.days.find((d) => d.isToday)?.localDate;
    const { pendingChangeCount, pendingRequestCount } = week.summary;
    const eventsFirst = week.settings.scheduleStyle === "events";

    return (
        <header className="flex flex-col gap-3" data-testid="schedule-header">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {locations.length > 1 ? (
                    <Select value={locationId} onValueChange={onLocation}>
                        <SelectTrigger aria-label="Location" className="h-11 w-auto min-w-40 text-lg font-semibold">
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
                    <h1 className="text-2xl font-semibold tracking-tight">{week.location.name}</h1>
                )}

                <div className="flex h-11 items-center rounded-full border bg-card px-1">
                    <Button variant="ghost" size="icon" className="size-9" aria-label="Previous week" onClick={() => onWeek(-1)}>
                        <ChevronLeft />
                    </Button>
                    <span
                        aria-live="polite"
                        className={cn("min-w-32 px-1 text-center text-sm font-semibold tabular-nums", busy && "opacity-60")}
                    >
                        {weekRangeLabel(week.days[0]!.localDate, week.days[6]!.localDate, today ?? week.days[0]!.localDate)}
                    </span>
                    <Button variant="ghost" size="icon" className="size-9" aria-label="Next week" onClick={() => onWeek(1)}>
                        <ChevronRight />
                    </Button>
                </div>
                {showToday ? (
                    <Button variant="outline" className="h-11" onClick={onToday}>
                        Today
                    </Button>
                ) : null}

                <div className="ml-auto flex items-center gap-2 max-md:w-full">
                    <div className="hidden items-center md:flex">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-10"
                            aria-label={history.undoLabel ? `Undo: ${history.undoLabel}` : "Undo"}
                            title={history.undoLabel ? `Undo: ${history.undoLabel} (z)` : "Undo (z)"}
                            disabled={!history.canUndo}
                            onClick={history.onUndo}
                        >
                            <Undo2 />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-10"
                            aria-label="Redo"
                            title="Redo (Shift+z)"
                            disabled={!history.canRedo}
                            onClick={history.onRedo}
                        >
                            <Redo2 />
                        </Button>
                    </div>

                    <div role="group" aria-label="View" className="hidden h-11 items-center gap-0.5 rounded-full border bg-muted p-1 md:flex">
                        {(["day", "week"] as const).map((value) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={layout === value}
                                data-testid={`schedule-view-${value}`}
                                onClick={() => onLayout(value)}
                                className={cn(
                                    "h-9 rounded-full px-4 text-sm font-medium capitalize text-muted-foreground transition-colors hover:text-foreground",
                                    layout === value && "bg-card text-foreground shadow-sm",
                                )}
                            >
                                {value}
                            </button>
                        ))}
                    </div>

                    {eventsFirst ? (
                        <Button variant="outline" className="hidden h-11 lg:inline-flex" onClick={onAddEvent}>
                            <CalendarPlus data-icon="inline-start" />
                            Event
                        </Button>
                    ) : null}

                    <Button className="h-11 px-5 max-md:flex-1" data-testid="add-shift" onClick={onAddShift}>
                        <Plus data-icon="inline-start" />
                        Add a shift
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="size-11" aria-label="More">
                                <MoreHorizontal />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                            <DropdownMenuItem className="h-10" onSelect={onCopyWeek}>
                                Copy last week…
                            </DropdownMenuItem>
                            <DropdownMenuItem className="h-10" onSelect={onTemplate}>
                                Use a template…
                            </DropdownMenuItem>
                            <DropdownMenuItem className="h-10" onSelect={onAddEvent}>
                                Add an event…
                            </DropdownMenuItem>
                            <DropdownMenuItem className="h-10" onSelect={onRequests}>
                                Requests{pendingRequestCount > 0 ? ` (${pendingRequestCount})` : ""}…
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="h-10 md:hidden" disabled={!history.canUndo} onSelect={history.onUndo}>
                                <Undo2 className="mr-2 size-4" />
                                {history.undoLabel ? `Undo: ${history.undoLabel}` : "Undo"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="h-10 md:hidden" disabled={!history.canRedo} onSelect={history.onRedo}>
                                <Redo2 className="mr-2 size-4" />
                                Redo
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onSelect={onDiscard}
                                disabled={pendingChangeCount === 0}
                                className="h-10 text-destructive focus:text-destructive"
                            >
                                Discard changes…
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild className="h-10">
                                <Link href="/settings/scheduling">Scheduling settings</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="h-10" onSelect={onHelp}>
                                How this works
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {week.departments.length > 1 || layout === "day" ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {week.departments.length > 1 ? (
                        <div
                            role="group"
                            aria-label="Department"
                            className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5"
                        >
                            {[{ id: ALL_DEPARTMENTS, name: "Everyone" }, ...week.departments].map((d) => (
                                <button
                                    key={d.id}
                                    type="button"
                                    aria-pressed={department === d.id}
                                    onClick={() => onDepartment(d.id)}
                                    className={cn(
                                        "h-10 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors",
                                        department === d.id
                                            ? "border-secondary bg-secondary text-secondary-foreground"
                                            : "bg-card text-foreground/80 hover:bg-muted",
                                    )}
                                >
                                    {d.name}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    {layout === "day" ? (
                        <label className="relative ml-auto hidden w-56 md:block">
                            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) => onSearch(event.target.value)}
                                placeholder="Find someone"
                                aria-label="Find a person"
                                className="h-10 w-full rounded-full border bg-card pl-10 pr-4 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                            />
                        </label>
                    ) : null}
                </div>
            ) : null}
        </header>
    );
}
