"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, Redo2, Undo2 } from "lucide-react";
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
import type { Density } from "./shift-chip";

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
    density,
    onDensity,
    onOpenCounter,
    onRequests,
    onHelp,
    busy,
    history,
    tools,
    onPublish,
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
    density: Density;
    onDensity: (density: Density) => void;
    onOpenCounter: () => void;
    onRequests: () => void;
    onHelp: () => void;
    busy: boolean;
    history: { canUndo: boolean; canRedo: boolean; undoLabel?: string; onUndo: () => void; onRedo: () => void };
    tools: { onCopyWeek: () => void; onTemplate: () => void; onAddEvent: () => void; onDiscard: () => void };
    onPublish: () => void;
}) {
    const isThisWeek = week.days.some((d) => d.isToday);
    const today = week.days.find((d) => d.isToday)?.localDate;
    const { openSlots, pendingChangeCount, pendingRequestCount } = week.summary;
    // Businesses that schedule around bookings get "Add event" on the toolbar itself.
    const eventsFirst = week.settings.scheduleStyle === "events";

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
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-9"
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
                        className="size-9"
                        aria-label="Redo"
                        title="Redo (Shift+z)"
                        disabled={!history.canRedo}
                        onClick={history.onRedo}
                    >
                        <Redo2 />
                    </Button>
                </div>
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
                    <button
                        type="button"
                        onClick={onRequests}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[13.5px] font-semibold text-foreground/80 hover:bg-muted hover:text-foreground"
                    >
                        <span aria-hidden className="grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] leading-5 text-primary-foreground">
                            {pendingRequestCount}
                        </span>
                        {pendingRequestCount === 1 ? "request" : "requests"}
                    </button>
                ) : null}
                {eventsFirst ? (
                    <Button variant="outline" className="h-9" onClick={tools.onAddEvent}>
                        <Plus data-icon="inline-start" />
                        Event
                    </Button>
                ) : null}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="size-9" aria-label="More">
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuItem onSelect={tools.onCopyWeek}>Copy last week…</DropdownMenuItem>
                        <DropdownMenuItem onSelect={tools.onTemplate}>Use a template…</DropdownMenuItem>
                        <DropdownMenuItem onSelect={tools.onAddEvent}>Add event…</DropdownMenuItem>
                        <DropdownMenuItem onSelect={onRequests}>Requests…</DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={tools.onDiscard}
                            disabled={pendingChangeCount === 0}
                            className="text-destructive focus:text-destructive"
                        >
                            Discard unpublished changes…
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>View by</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={viewMode} onValueChange={(v) => onViewMode(v as ViewMode)}>
                            <DropdownMenuRadioItem value="people">People</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="positions">Positions</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                        <DropdownMenuLabel>Shift cards</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={density} onValueChange={(v) => onDensity(v as Density)}>
                            <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="compact">Compact (one line)</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/settings/scheduling">Scheduling settings</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={onHelp}>Help and shortcuts</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button
                    className="h-9"
                    disabled={pendingChangeCount === 0}
                    onClick={onPublish}
                    title={pendingChangeCount === 0 ? "Nothing to publish" : undefined}
                >
                    Publish{pendingChangeCount > 0 ? ` ${pendingChangeCount}` : ""}
                </Button>
            </div>
        </div>
    );
}
