"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, CircleHelp, MapPin, MoreHorizontal, Plus, Redo2, Undo2 } from "lucide-react";
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
 * The same header for Day, Week and Month: the period switch, the dates in the
 * middle, and the two things a manager does most, add a shift and publish.
 * Everything else is in the "…" menu.
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
    // What used to be a status line under the header: now the publish button's hover text.
    const pendingNote = [
        parts.length > 0 ? `${parts.join(" · ")}. Only managers can see ${drafts > 0 && edited === 0 ? "drafts" : "these changes"} until you publish.` : null,
        elsewhereCount > 0 ? `${plural(elsewhereCount, "more change")} at ${elsewhere.map((s) => s.name).join(", ")} not in view.` : null,
    ]
        .filter(Boolean)
        .join(" ");
    const unit = view === "month" ? "month" : view === "day" ? "day" : "week";

    // One line, three parts: which period on the left, the dates in the middle, the actions on the right.
    return (
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 lg:grid lg:grid-cols-[1fr_auto_1fr]">
            <h1 className="sr-only">Schedule</h1>
            <div className="flex min-w-0 items-center gap-2">
                <PeriodSwitch value={view} onChange={onView} />
                {sites.length > 1 ? (
                    <Select value={scope} onValueChange={onScope}>
                        <SelectTrigger aria-label="Site" className="h-9 w-auto min-w-40 rounded-lg bg-card text-sm font-medium">
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
                ) : null}
            </div>

            {/* "Today" hangs off the right arrow, so the dates stay centred whether it shows or not. */}
            <div className="relative order-first flex w-full min-w-0 items-center justify-center gap-1 lg:order-none lg:w-auto">
                <button type="button" aria-label={`Previous ${unit}`} onClick={onPrev} className={iconButton}>
                    <ChevronLeft aria-hidden className="size-5" />
                </button>
                <p aria-live="polite" className={cn("whitespace-nowrap px-1 text-center text-2xl font-bold tracking-tight tabular-nums", busy && "opacity-60")}>
                    {dateLabel}
                </p>
                <button type="button" aria-label={`Next ${unit}`} onClick={onNext} className={iconButton}>
                    <ChevronRight aria-hidden className="size-5" />
                </button>
                {onThisPeriod ? null : (
                    <Button variant="ghost" size="sm" className="text-sm font-semibold text-primary hover:text-primary lg:absolute lg:left-full lg:ml-1" onClick={onToday}>
                        Today
                    </Button>
                )}
            </div>

            <div className="ml-auto flex items-center gap-2 lg:justify-self-end">
                <Button variant="outline" size="icon" className="size-9 rounded-lg" aria-label="Add shift" title="Add shift" onClick={onAddShift}>
                    <Plus />
                </Button>
                {pending > 0 ? (
                    <Button className="h-9 rounded-lg px-4 text-sm font-semibold" onClick={onReview} disabled={reviewBusy} title={pendingNote}>
                        Publish {pending}
                    </Button>
                ) : (
                    <span className="flex h-9 items-center gap-1 px-2 text-sm text-muted-foreground" title={pendingNote || "Everything in view is published"}>
                        <Check aria-hidden className="size-4" />
                        Published
                    </span>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-9 rounded-lg" aria-label="More">
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuItem onSelect={history.onUndo} disabled={!history.canUndo}>
                            <Undo2 aria-hidden />
                            {history.undoLabel ? `Undo: ${history.undoLabel}` : "Undo"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={history.onRedo} disabled={!history.canRedo}>
                            <Redo2 aria-hidden />
                            Redo
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
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
                        <DropdownMenuItem onSelect={onHelp}>
                            <CircleHelp aria-hidden />
                            Help and shortcuts
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}

const iconButton =
    "grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";

/** Day, Week, Month: three quiet words, the current one on a grey pill. */
function PeriodSwitch({ value, onChange }: { value: ScheduleView; onChange: (view: ScheduleView) => void }) {
    const options: [ScheduleView, string][] = [
        ["day", "Day"],
        ["week", "Week"],
        ["month", "Month"],
    ];
    return (
        <div role="group" aria-label="View" className="flex items-center gap-1">
            {options.map(([id, name]) => (
                <button
                    key={id}
                    type="button"
                    aria-pressed={value === id}
                    onClick={() => onChange(id)}
                    className={cn(
                        "h-9 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                        value === id && "bg-muted font-semibold text-foreground",
                    )}
                >
                    {name}
                </button>
            ))}
        </div>
    );
}

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
