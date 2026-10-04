"use client";

import { ChevronRight, Plus } from "lucide-react";
import type { SchedulerShift } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import type { AddShiftPrefill } from "@/lib/scheduler/add-shift";
import { dayOfMonth, longDate, weekdayShort } from "@/lib/scheduler/format";
import { buildDayPlan, rangeLabel, unfilledByDay, type DayItem, type Publication, type RoleBlock, type Workspace } from "@/lib/scheduler/workspace";
import { Segmented } from "./schedule-header";

export type DayFilter = "all" | "needs";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const PUBLICATION_LABEL: Record<Publication, string> = {
    draft: "Draft",
    published: "Published",
    mixed: "Published · draft changes",
};

function PublicationTag({ publication }: { publication: Publication }) {
    return (
        <span
            className={cn(
                "inline-flex w-fit items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                publication === "draft" ? "border-[1.5px] border-dashed border-border text-muted-foreground" : "bg-muted text-foreground/80",
            )}
        >
            {PUBLICATION_LABEL[publication]}
        </span>
    );
}

function staffingText(item: Pick<DayItem, "assigned" | "needed" | "unfilled">) {
    return item.unfilled > 0
        ? `${item.assigned} of ${item.needed} assigned · ${item.unfilled} unfilled`
        : `${item.assigned} of ${item.needed} assigned · Fully staffed`;
}

function BlockDetails({
    item,
    block,
    onOpenShift,
    onRemovePerson,
}: {
    item: DayItem;
    block: RoleBlock;
    onOpenShift: (shiftId: string) => void;
    onRemovePerson: (shift: SchedulerShift, personId: string) => void;
}) {
    const { shift } = block;
    const range = rangeLabel({ startLocal: shift.startLocal, endLocal: shift.endLocal, overnight: shift.overnight });
    return (
        <section aria-label={`${shift.role}, ${range}`} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h4 className="text-[13px] font-bold">
                    {shift.role} <span className="font-medium text-muted-foreground">· {range}</span>
                </h4>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                        {shift.filled} of {shift.capacity} assigned
                    </span>
                    <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => onOpenShift(shift.id)}>
                        Edit
                    </button>
                </div>
            </div>

            <ul className="flex flex-col">
                {block.people.map(({ person, assignee }) => {
                    const removed = assignee.pendingState === "remove";
                    return (
                        <li key={assignee.personId} className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 text-[13px] last:border-b-0">
                            <span className="min-w-0">
                                <span className={cn("font-medium", removed && "line-through opacity-60")}>{person?.name ?? "Someone no longer on the team"}</span>
                                {assignee.pendingState === "add" ? <span className="text-muted-foreground"> · Draft</span> : null}
                                {removed ? <span className="text-muted-foreground"> · coming off when published</span> : null}
                                {assignee.warnings.map((w) => (
                                    <span key={w.message} className={cn("block text-xs", w.severity === "block" ? "text-destructive" : "text-muted-foreground")}>
                                        {w.message}
                                    </span>
                                ))}
                            </span>
                            {removed ? null : (
                                <button
                                    type="button"
                                    className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
                                    aria-label={`Remove ${person?.name ?? "this person"} from ${shift.role} at ${item.name}`}
                                    onClick={() => onRemovePerson(shift, assignee.personId)}
                                >
                                    Remove
                                </button>
                            )}
                        </li>
                    );
                })}
                {Array.from({ length: block.unfilled }).map((_, index) => (
                    <li key={`open-${index}`} className="py-1">
                        <div className="flex items-center justify-between gap-3 rounded-lg border-[1.5px] border-dashed border-border px-3 py-1.5 text-[13px]">
                            <span className="text-muted-foreground">Unfilled position · {shift.role}</span>
                            <Button size="sm" variant="outline" className="h-7 px-3 text-xs font-semibold" onClick={() => onOpenShift(shift.id)}>
                                Assign
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function EventRow({
    item,
    expanded,
    onToggle,
    onOpenShift,
    onAddShift,
    onRemovePerson,
    onEditEvent,
    date,
    showSite,
}: {
    item: DayItem;
    expanded: boolean;
    onToggle: () => void;
    onOpenShift: (shiftId: string) => void;
    onAddShift: (prefill: AddShiftPrefill) => void;
    onRemovePerson: (shift: SchedulerShift, personId: string) => void;
    onEditEvent: (eventId: string) => void;
    date: string;
    showSite: boolean;
}) {
    const panelId = `day-item-${item.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    return (
        <li className="border-b border-border last:border-b-0">
            <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={onToggle}
                className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring md:grid-cols-[1.25rem_minmax(0,1.5fr)_6.5rem_minmax(0,1.1fr)_minmax(0,1.5fr)_9.5rem]"
            >
                <ChevronRight aria-hidden className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-90")} />
                <span className="min-w-0 truncate text-[14.5px] font-bold">
                    {item.name}
                    <span className="sr-only">, {expanded ? "collapse" : "expand"}</span>
                </span>
                <span className="col-start-2 text-[13px] font-semibold tabular-nums md:col-start-auto">{rangeLabel(item)}</span>
                <span className="col-start-2 min-w-0 truncate text-[13px] text-muted-foreground md:col-start-auto">{showSite ? item.siteName : item.kind === "event" ? "Event" : "Service"}</span>
                <span className="col-start-2 text-[13px] text-foreground/80 md:col-start-auto">{staffingText(item)}</span>
                <span className="col-start-2 md:col-start-auto md:justify-self-end">
                    <PublicationTag publication={item.publication} />
                </span>
            </button>

            {expanded ? (
                <div id={panelId} className="flex flex-col gap-4 border-t border-dashed border-border bg-muted/20 px-4 py-3.5 pl-[2.75rem]">
                    <p className="text-xs text-muted-foreground">
                        {item.siteName} · {longDate(date)}
                    </p>
                    {item.blocks.map((block) => (
                        <BlockDetails key={block.shift.id} item={item} block={block} onOpenShift={onOpenShift} onRemovePerson={onRemovePerson} />
                    ))}
                    <div className="flex flex-wrap items-center gap-4">
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            onClick={() =>
                                onAddShift({
                                    localDate: date,
                                    siteId: item.siteId,
                                    eventId: item.eventId,
                                    eventName: item.kind === "event" ? item.name : undefined,
                                    startLocal: item.startLocal,
                                    endLocal: item.endLocal,
                                })
                            }
                        >
                            <Plus aria-hidden className="size-3.5" />
                            Add a role
                        </button>
                        {item.eventId ? (
                            <button type="button" className="text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => onEditEvent(item.eventId!)}>
                                Edit event
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </li>
    );
}

/**
 * One day, as an agenda: the events and services in time order, overlapping
 * ones at different sites side by side in the list. Rows stay collapsed so
 * eight or ten fit on a screen; one opens to show who is on each role and
 * which positions are still empty.
 */
export function DayPlan({
    ws,
    date,
    filter,
    onFilter,
    onDate,
    expanded,
    onToggle,
    onOpenShift,
    onAddShift,
    onRemovePerson,
    onEditEvent,
    siteScoped,
}: {
    ws: Workspace;
    date: string;
    filter: DayFilter;
    onFilter: (filter: DayFilter) => void;
    onDate: (date: string) => void;
    expanded: Set<string>;
    onToggle: (key: string) => void;
    onOpenShift: (shiftId: string) => void;
    onAddShift: (prefill: AddShiftPrefill) => void;
    onRemovePerson: (shift: SchedulerShift, personId: string) => void;
    onEditEvent: (eventId: string) => void;
    /** One site in view: its name need not repeat on every row. */
    siteScoped: boolean;
}) {
    const everything = buildDayPlan(ws, date);
    const items = filter === "needs" ? everything.filter((i) => i.unfilled > 0) : everything;
    const needs = unfilledByDay(ws);

    return (
        <div className="flex flex-col gap-4">
            <nav aria-label="Days of the week" className="grid grid-cols-7 gap-1.5">
                {ws.week.days.map((day, index) => {
                    const selected = day.localDate === date;
                    const unfilled = needs[index]?.unfilled ?? 0;
                    return (
                        <button
                            key={day.localDate}
                            type="button"
                            aria-current={selected ? "date" : undefined}
                            onClick={() => onDate(day.localDate)}
                            className={cn(
                                "flex min-w-0 flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                                selected ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50",
                            )}
                        >
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{weekdayShort(day.localDate)}</span>
                            <span className={cn("flex items-center gap-1 text-[15px] font-bold tabular-nums", selected && "text-primary")}>
                                {dayOfMonth(day.localDate)}
                                {day.isToday ? <span aria-label="today" className="size-[7px] rounded-full bg-primary" /> : null}
                            </span>
                            <span className="min-h-4 truncate text-[11px] text-muted-foreground">{unfilled > 0 ? `${unfilled} unfilled` : ""}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[15px] font-bold">
                    {longDate(date)} <span className="font-medium text-muted-foreground">· {plural(everything.length, "event")}</span>
                </h2>
                <Segmented
                    label="Show"
                    value={filter}
                    onChange={(v) => onFilter(v as DayFilter)}
                    options={[
                        ["all", "All events"],
                        ["needs", "Needs people"],
                    ]}
                />
            </div>

            {everything.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
                    <p className="text-[15px] font-bold">Nothing is scheduled for {longDate(date)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{siteScoped ? "Add a shift to start the day." : "Add a shift at any site to start the day."}</p>
                    <Button className="mt-4" variant="outline" onClick={() => onAddShift({ localDate: date })}>
                        <Plus data-icon="inline-start" aria-hidden />
                        Add shift
                    </Button>
                </div>
            ) : items.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
                    <p className="text-[15px] font-bold">Everyone is assigned for {longDate(date)}</p>
                    <button type="button" className="mt-2 text-sm font-semibold text-primary hover:underline" onClick={() => onFilter("all")}>
                        Show all {plural(everything.length, "event")}
                    </button>
                </div>
            ) : (
                <ul className="overflow-hidden rounded-2xl border bg-card">
                    {items.map((item) => (
                        <EventRow
                            key={item.key}
                            item={item}
                            date={date}
                            showSite={!siteScoped}
                            expanded={expanded.has(item.key)}
                            onToggle={() => onToggle(item.key)}
                            onOpenShift={onOpenShift}
                            onAddShift={onAddShift}
                            onRemovePerson={onRemovePerson}
                            onEditEvent={onEditEvent}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

