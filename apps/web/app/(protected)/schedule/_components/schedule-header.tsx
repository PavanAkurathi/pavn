"use client";

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, CircleHelp, MapPin, Plus, Redo2, Undo2 } from "lucide-react";
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
import { ALL_SITES, type Site } from "@/lib/scheduler/workspace";
import type { Density } from "./shift-chip";

export type ScheduleView = "week" | "day" | "month";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The same header for both views: what this is, which view, which dates, which
 * site, and the two things a manager does most: add a shift and review what
 * staff will see. What is unpublished is one quiet line, not a banner.
 */
export function ScheduleHeader({
    view,
    onView,
    dateLabel,
    onPrev,
    onNext,
    onToday,
    onThisPeriod,
    sites,
    scope,
    onScope,
    onAddShift,
    drafts,
    edited,
    pending,
    elsewhere,
    onReview,
    reviewBusy,
    busy,
    history,
    tools,
    density,
    onDensity,
    showDensity,
    onHelp,
}: {
    view: ScheduleView;
    onView: (view: ScheduleView) => void;
    dateLabel: string;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    /** Already showing the week (or day) that holds today. */
    onThisPeriod: boolean;
    sites: Site[];
    scope: string;
    onScope: (scope: string) => void;
    onAddShift: () => void;
    /** Draft shifts at the sites in view. */
    drafts: number;
    /** Published shifts at the sites in view with changes staff can't see yet. */
    edited: number;
    /** Everything unpublished at the sites in view (drafts, edits and removals). */
    pending: number;
    /** Unpublished changes at sites the filter leaves out. */
    elsewhere: { name: string; count: number }[];
    onReview: () => void;
    reviewBusy: boolean;
    busy: boolean;
    history: { canUndo: boolean; canRedo: boolean; undoLabel?: string; onUndo: () => void; onRedo: () => void };
    /** Copy and templates work on one site; discard works on the sites in view. */
    tools: { singleSite: boolean; onCopyWeek: () => void; onTemplate: () => void; onAddEvent: () => void; onDiscard: () => void };
    density: Density;
    onDensity: (density: Density) => void;
    /** Entry size only matters on the week grid. */
    showDensity: boolean;
    onHelp: () => void;
}) {
    const elsewhereCount = elsewhere.reduce((sum, s) => sum + s.count, 0);
    const parts = [
        drafts > 0 ? plural(drafts, "draft shift") : null,
        edited > 0 ? `${plural(edited, "published shift")} changed` : null,
        // Removals and staged people changes are counted in `pending` but are neither drafts nor edits.
        drafts === 0 && edited === 0 && pending > 0 ? plural(pending, "unpublished change") : null,
    ].filter(Boolean);

    return (
        <header className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Schedule</h1>
                <div className="flex items-center gap-1">
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
                    <Button variant="ghost" size="icon" className="size-8" aria-label="Redo" title="Redo (Shift+z)" disabled={!history.canRedo} onClick={history.onRedo}>
                        <Redo2 />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" aria-label="Help and shortcuts" title="Help and shortcuts (?)" onClick={onHelp}>
                        <CircleHelp />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-8 gap-1 px-3 text-sm font-semibold">
                                Tools
                                <ChevronDown aria-hidden className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                            <DropdownMenuItem onSelect={tools.onCopyWeek} disabled={!tools.singleSite}>
                                Copy last week…
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={tools.onTemplate} disabled={!tools.singleSite}>
                                Use a template…
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={tools.onAddEvent} disabled={!tools.singleSite}>
                                Add event…
                            </DropdownMenuItem>
                            {tools.singleSite ? null : (
                                <p className="px-2 py-1 text-xs text-muted-foreground">Pick a site to copy a week, use a template or add an event.</p>
                            )}
                            <DropdownMenuItem onSelect={tools.onDiscard} disabled={pending === 0} className="text-destructive focus:text-destructive">
                                Discard unpublished changes…
                            </DropdownMenuItem>
                            {showDensity ? (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel>Shift entries</DropdownMenuLabel>
                                    <DropdownMenuRadioGroup value={density} onValueChange={(v) => onDensity(v as Density)}>
                                        <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="compact">Compact (one line)</DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/settings/scheduling">Scheduling settings</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={onHelp}>Help and shortcuts</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Segmented
                    label="View"
                    value={view}
                    onChange={(v) => onView(v as ScheduleView)}
                    options={[
                        ["day", "Day"],
                        ["week", "Week"],
                        ["month", "Month"],
                    ]}
                />

                <div className="flex items-center gap-2">
                    <button type="button" aria-label={`Previous ${view === "month" ? "month" : view === "day" ? "day" : "week"}`} onClick={onPrev} className={squareButton}>
                        <ChevronLeft aria-hidden className="size-4" />
                    </button>
                    <span
                        aria-live="polite"
                        className={cn("flex h-10 min-w-[11.5rem] items-center justify-center whitespace-nowrap rounded-lg border bg-card px-4 text-sm font-medium tabular-nums", busy && "opacity-60")}
                    >
                        {dateLabel}
                    </span>
                    <button type="button" aria-label={`Next ${view === "month" ? "month" : view === "day" ? "day" : "week"}`} onClick={onNext} className={squareButton}>
                        <ChevronRight aria-hidden className="size-4" />
                    </button>
                    <Button variant="ghost" className="h-10 px-2 text-sm font-semibold text-primary hover:text-primary" onClick={onToday} disabled={onThisPeriod}>
                        Today
                    </Button>
                </div>

                {sites.length > 1 ? (
                    <Select value={scope} onValueChange={onScope}>
                        <SelectTrigger aria-label="Site" className="h-10 w-auto min-w-44 rounded-lg bg-card text-sm font-medium">
                            <MapPin aria-hidden className="size-4 text-muted-foreground" />
                            <SelectValue>{scope === ALL_SITES ? "All sites" : (sites.find((s) => s.id === scope)?.name ?? "All sites")}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_SITES}>All sites</SelectItem>
                            {sites.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <span className="flex h-10 items-center gap-1.5 rounded-lg border bg-card px-3.5 text-sm font-medium">
                        <MapPin aria-hidden className="size-4 text-muted-foreground" />
                        {sites[0]?.name}
                    </span>
                )}

                <div className="ml-auto flex items-center gap-2.5">
                    <Button
                        variant="outline"
                        className="h-10 rounded-lg border-primary/30 bg-primary/5 px-4 text-sm font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={onAddShift}
                    >
                        <Plus data-icon="inline-start" aria-hidden />
                        Add shift
                    </Button>
                    <Button className="h-10 rounded-lg px-5 text-sm font-semibold" onClick={onReview} disabled={pending === 0 || reviewBusy} title={pending === 0 ? "Nothing to publish in this view" : undefined}>
                        {pending > 0 ? `Publish and notify (${pending})` : "Publish"}
                    </Button>
                </div>
            </div>

            <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
                {parts.length > 0 ? `${parts.join(" · ")} · Only managers can see ${drafts > 0 && edited === 0 ? "drafts" : "these changes"}` : null}
                {parts.length > 0 && elsewhereCount > 0 ? " · " : null}
                {elsewhereCount > 0 ? `${plural(elsewhereCount, "more change")} at ${elsewhere.map((s) => s.name).join(", ")} not in view` : null}
            </p>
        </header>
    );
}

const squareButton =
    "flex size-10 items-center justify-center rounded-lg border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

/** A small switch: exactly one of a few options is on. */
export function Segmented({
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
        <div role="group" aria-label={label} className="flex h-10 max-w-full items-center gap-1 overflow-x-auto rounded-lg border bg-card p-1">
            {options.map(([id, name]) => (
                <button
                    key={id}
                    type="button"
                    aria-pressed={value === id}
                    onClick={() => onChange(id)}
                    className={cn(
                        "h-full whitespace-nowrap rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                        value === id && "bg-primary/10 font-semibold text-primary hover:text-primary",
                    )}
                >
                    {name}
                </button>
            ))}
        </div>
    );
}
