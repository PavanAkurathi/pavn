"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleHelp, MoreHorizontal, Plus, Redo2, Undo2 } from "lucide-react";
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

export type ScheduleView = "week" | "day";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The same header for both views: what this is, which view, which dates,
 * which site, and the two things a manager does most: add a shift and review
 * what staff will see. What is unpublished is said quietly under the title,
 * not in a banner.
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
    /** Unpublished changes at the sites in view. */
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

    return (
        <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Schedule</h1>
                    <p className="mt-0.5 min-h-5 text-sm text-muted-foreground" aria-live="polite">
                        {pending > 0 ? `${plural(pending, "unpublished change")}` : null}
                        {pending > 0 && elsewhereCount > 0 ? " · " : null}
                        {elsewhereCount > 0
                            ? `${plural(elsewhereCount, "more change")} at ${elsewhere.map((s) => s.name).join(", ")} not in view`
                            : null}
                        {pending === 0 && elsewhereCount === 0 ? "Everything here is published." : null}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={onAddShift}>
                        <Plus data-icon="inline-start" aria-hidden />
                        Add shift
                    </Button>
                    <Button onClick={onReview} disabled={pending === 0 || reviewBusy} title={pending === 0 ? "Nothing to publish in this view" : undefined}>
                        Review &amp; publish
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
                <Segmented
                    label="View"
                    value={view}
                    onChange={(v) => onView(v as ScheduleView)}
                    options={[
                        ["week", "Team week"],
                        ["day", "Day plan"],
                    ]}
                />

                <div className="flex items-center gap-1.5">
                    <button type="button" aria-label={view === "week" ? "Previous week" : "Previous day"} onClick={onPrev} className={arrowButton}>
                        <ChevronLeft aria-hidden className="size-4" />
                    </button>
                    <span aria-live="polite" className={cn("min-w-[140px] whitespace-nowrap text-center text-[13px] font-semibold tabular-nums", busy && "opacity-60")}>
                        {dateLabel}
                    </span>
                    <button type="button" aria-label={view === "week" ? "Next week" : "Next day"} onClick={onNext} className={arrowButton}>
                        <ChevronRight aria-hidden className="size-4" />
                    </button>
                </div>
                <Button variant="outline" className="h-8 px-3 text-xs font-semibold" onClick={onToday} disabled={onThisPeriod}>
                    Today
                </Button>

                {sites.length > 1 ? (
                    <Select value={scope} onValueChange={onScope}>
                        <SelectTrigger aria-label="Site" className="h-8 w-auto min-w-36 text-[13px] font-semibold">
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
                    <span className="px-1 text-[13px] font-semibold text-muted-foreground">{sites[0]?.name}</span>
                )}

                <div className="ml-auto flex items-center gap-1">
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
                            <Button variant="outline" size="icon" className="size-8" aria-label="More">
                                <MoreHorizontal />
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
        </header>
    );
}

const arrowButton =
    "flex size-[26px] items-center justify-center rounded-chip border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

/** A small pill switch: exactly one of a few options is on. */
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
