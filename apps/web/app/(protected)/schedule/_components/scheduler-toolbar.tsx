"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleHelp, MoreHorizontal, Plus, Redo2, Undo2 } from "lucide-react";
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
import type { PublishPhase } from "@/lib/scheduler/use-publish";
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
    onRequests,
    onHelp,
    busy,
    history,
    tools,
    onPublish,
    publishPhase,
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
    onRequests: () => void;
    onHelp: () => void;
    busy: boolean;
    history: { canUndo: boolean; canRedo: boolean; undoLabel?: string; onUndo: () => void; onRedo: () => void };
    tools: { onCopyWeek: () => void; onTemplate: () => void; onAddEvent: () => void; onDiscard: () => void };
    onPublish: () => void;
    publishPhase: PublishPhase;
}) {
    const isThisWeek = week.days.some((d) => d.isToday);
    const today = week.days.find((d) => d.isToday)?.localDate;
    const { pendingChangeCount } = week.summary;
    // Businesses that schedule around bookings get "Add event" on the toolbar itself.
    const eventsFirst = week.settings.scheduleStyle === "events";

    return (
        <div className="flex flex-wrap items-center gap-2.5">
            {locations.length > 1 ? (
                <Select value={locationId} onValueChange={onLocation}>
                    <SelectTrigger aria-label="Location" className="h-8 w-auto min-w-40 text-[13px] font-semibold">
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
                <span className="px-1 text-[15px] font-bold tracking-tight">{week.location.name}</span>
            )}

            <div className="flex items-center gap-1.5">
                <button type="button" aria-label="Previous week" onClick={() => onWeek(-1)} className={arrowButton}>
                    <ChevronLeft aria-hidden className="size-4" />
                </button>
                <span
                    aria-live="polite"
                    className={cn("min-w-[148px] whitespace-nowrap text-center text-[13px] font-semibold tabular-nums", busy && "opacity-60")}
                >
                    {weekRangeLabel(week.days[0]!.localDate, week.days[6]!.localDate, today ?? week.days[0]!.localDate)}
                </span>
                <button type="button" aria-label="Next week" onClick={() => onWeek(1)} className={arrowButton}>
                    <ChevronRight aria-hidden className="size-4" />
                </button>
            </div>

            <Button variant="outline" className={toolbarButton} onClick={onThisWeek} disabled={isThisWeek} title={isThisWeek ? "You're on this week" : undefined}>
                Today
            </Button>

            <Segmented
                label="Board"
                value={viewMode}
                onChange={(mode) => onViewMode(mode as ViewMode)}
                options={[
                    ["positions", "Roles"],
                    ["people", "People"],
                ]}
            />

            {week.departments.length > 1 ? (
                <Segmented
                    label="Department"
                    value={department}
                    onChange={onDepartment}
                    options={[[ALL_DEPARTMENTS, "All"], ...week.departments.map((d) => [d.id, d.name] as [string, string])]}
                />
            ) : null}

            <div className="ml-auto flex flex-wrap items-center gap-2">
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
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
                        className="size-8"
                        aria-label="Redo"
                        title="Redo (Shift+z)"
                        disabled={!history.canRedo}
                        onClick={history.onRedo}
                    >
                        <Redo2 />
                    </Button>
                </div>
                {eventsFirst ? (
                    <Button variant="outline" className={toolbarButton} onClick={tools.onAddEvent}>
                        <Plus data-icon="inline-start" />
                        Event
                    </Button>
                ) : null}
                <Button variant="outline" className={toolbarButton} onClick={tools.onCopyWeek}>
                    Copy last week
                </Button>
                <Button variant="ghost" size="icon" className="size-8" aria-label="Help and shortcuts" title="Help and shortcuts (?)" onClick={onHelp}>
                    <CircleHelp />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="size-8" aria-label="More">
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
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
                    className={toolbarButton}
                    disabled={pendingChangeCount === 0 || publishPhase !== "idle"}
                    onClick={onPublish}
                    title={pendingChangeCount === 0 ? "Nothing to publish" : undefined}
                >
                    {publishPhase === "checking"
                        ? "Checking…"
                        : publishPhase === "waiting"
                            ? "Publishing…"
                            : publishPhase === "sending"
                                ? "Sending…"
                                : `Publish${pendingChangeCount > 0 ? ` (${pendingChangeCount})` : ""}`}
                </Button>
            </div>
        </div>
    );
}

const toolbarButton = "h-8 px-3 text-xs font-semibold";
const arrowButton =
    "flex size-[26px] items-center justify-center rounded-chip border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

/** A small pill switch: exactly one of a few options is on. */
function Segmented({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: [string, string][];
}) {
    return (
        <div role="group" aria-label={label} className="flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-control border bg-muted p-0.5">
            {options.map(([id, name]) => (
                <button
                    key={id}
                    type="button"
                    aria-pressed={value === id}
                    onClick={() => onChange(id)}
                    className={cn(
                        "h-full whitespace-nowrap rounded-chip px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground",
                        value === id && "bg-card text-foreground shadow-sm",
                    )}
                >
                    {name}
                </button>
            ))}
        </div>
    );
}
