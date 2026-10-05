"use client";

import { Check, ChevronDown, Plus, UserPlus } from "lucide-react";
import type { SchedulerShift } from "@repo/contracts/scheduler";
import { InitialsAvatar } from "@repo/ui/components/app/initials-avatar";
import { Button } from "@repo/ui/components/ui/button";
import { roleHue } from "@repo/ui/lib/role-hue";
import { cn } from "@repo/ui/lib/utils";
import type { AddShiftPrefill } from "@/lib/scheduler/add-shift";
import { clockRange, dayOfMonth, longDate, weekdayShort } from "@/lib/scheduler/format";
import type { Plan } from "@/lib/scheduler/plans";
import { buildDayPlan, unfilledByDay, type DayItem, type RoleBlock, type Workspace } from "@/lib/scheduler/workspace";
import { AssignPanel } from "./assign-panel";
import { Segmented } from "./schedule-header";

export type DayFilter = "all" | "needs";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const PEOPLE_SHOWN = 8;
const ASSIGN_BUTTONS_SHOWN = 3;

/** "11am – 4pm", with the next-day mark when it ends after midnight. */
const timeText = (item: { startLocal: string; endLocal: string; overnight: boolean }) =>
    `${clockRange(item.startLocal, item.endLocal, { spaced: true })}${item.overnight ? " +1" : ""}`;

function Pill({ tone, children }: { tone: "covered" | "open" | "draft"; children: React.ReactNode }) {
    return (
        <span
            className={cn(
                "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                tone === "covered" && "bg-emerald-50 text-emerald-800",
                tone === "open" && "bg-amber-100 text-amber-800",
                tone === "draft" && "border border-dashed border-border bg-card text-muted-foreground",
            )}
        >
            {children}
        </span>
    );
}

/** What the row says about staffing: covered, or how many positions are still empty and what that means. */
function StaffingPill({ item }: { item: DayItem }) {
    if (item.unfilled === 0) {
        return (
            <Pill tone="covered">
                <Check aria-hidden className="size-3.5" />
                Covered
            </Pill>
        );
    }
    // A published position nobody has taken is open for pickup; one still in a draft will be once published.
    return (
        <Pill tone="open">
            {item.openNow > 0 ? `${item.openNow} open for pickup` : null}
            {item.openNow > 0 && item.openLater > 0 ? " · " : null}
            {item.openLater > 0 ? `${item.openLater} unfilled` : null}
        </Pill>
    );
}

function rolesLine(item: DayItem) {
    const roles = [...new Set(item.blocks.map((b) => b.shift.role))];
    const base = roles.join(" · ");
    return item.unfilled > 0 ? `${base} · ${item.assigned} of ${item.needed} assigned` : base;
}

function BlockDetails({
    block,
    onAssign,
    onOpenShift,
    onRemovePerson,
    itemName,
}: {
    block: RoleBlock;
    onAssign: (shiftId: string) => void;
    onOpenShift: (shiftId: string) => void;
    onRemovePerson: (shift: SchedulerShift, personId: string) => void;
    itemName: string;
}) {
    const { shift } = block;
    const range = timeText({ startLocal: shift.startLocal, endLocal: shift.endLocal, overnight: shift.overnight });
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
                                    aria-label={`Remove ${person?.name ?? "this person"} from ${shift.role} at ${itemName}`}
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
                            <span className="text-muted-foreground">
                                {block.live ? "Open for pickup" : "Unfilled · will open for pickup when published"} · {shift.role}
                            </span>
                            <Button size="sm" variant="outline" className="h-7 px-3 text-xs font-semibold" onClick={() => onAssign(shift.id)}>
                                Assign
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function AgendaRow({
    item,
    expanded,
    onToggle,
    onAssign,
    onOpenShift,
    onAddShift,
    onRemovePerson,
    onEditEvent,
    date,
    showSite,
    assigning,
}: {
    item: DayItem;
    expanded: boolean;
    onToggle: () => void;
    onAssign: (shiftId: string) => void;
    onOpenShift: (shiftId: string) => void;
    onAddShift: (prefill: AddShiftPrefill) => void;
    onRemovePerson: (shift: SchedulerShift, personId: string) => void;
    onEditEvent: (eventId: string) => void;
    date: string;
    showSite: boolean;
    /** The shift whose Assign panel is open, so its row can say so. */
    assigning: string | null;
}) {
    const panelId = `day-item-${item.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const people = item.blocks.flatMap((b) => b.people.map((p) => ({ ...p, role: b.shift.role })));
    const seen = new Set<string>();
    const uniquePeople = people.filter((p) => (seen.has(p.assignee.personId) ? false : (seen.add(p.assignee.personId), true)));
    const empties = item.blocks.filter((b) => b.unfilled > 0);

    return (
        <li className={cn("border-t first:border-t-0", item.blocks.some((b) => b.shift.id === assigning) && "bg-primary/[0.03]")}>
            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-5 px-1 py-5 md:grid-cols-[8rem_1px_minmax(0,1fr)] md:gap-x-6">
                <div className="pt-0.5 text-[15px] font-medium tabular-nums text-foreground">{timeText(item)}</div>
                <div aria-hidden className="hidden bg-border md:block" />

                <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <h3 className="text-[18px] font-semibold leading-snug">{item.name}</h3>
                                <StaffingPill item={item} />
                                {item.publication === "draft" ? <Pill tone="draft">Draft</Pill> : item.publication === "mixed" ? <Pill tone="draft">Draft changes</Pill> : null}
                            </div>
                            <p className="mt-0.5 text-[14px] text-muted-foreground">
                                {rolesLine(item)}
                                {showSite ? ` · ${item.siteName}` : ""}
                            </p>
                        </div>
                        <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={panelId}
                            aria-label={`${item.name}, ${expanded ? "collapse" : "expand"} details`}
                            onClick={onToggle}
                            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                        >
                            <ChevronDown aria-hidden className={cn("size-5 transition-transform", expanded && "rotate-180")} />
                        </button>
                    </div>

                    <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-3">
                        {uniquePeople.slice(0, PEOPLE_SHOWN).map(({ person, assignee, role }) => (
                            <span key={assignee.personId} className="inline-flex items-center gap-2.5">
                                <InitialsAvatar name={person?.name ?? "?"} size="lg" tone="soft" hue={roleHue(person?.primaryRole ?? role)} />
                                <span className={cn("text-[14.5px]", assignee.pendingState === "remove" && "line-through opacity-60")}>{person?.name ?? "Someone"}</span>
                            </span>
                        ))}
                        {uniquePeople.length > PEOPLE_SHOWN ? <span className="text-sm text-muted-foreground">+{uniquePeople.length - PEOPLE_SHOWN} more</span> : null}
                        {empties.flatMap((block) =>
                            Array.from({ length: Math.min(block.unfilled, ASSIGN_BUTTONS_SHOWN) }).map((_, index) => (
                                <button
                                    key={`${block.shift.id}-${index}`}
                                    type="button"
                                    onClick={() => onAssign(block.shift.id)}
                                    className="inline-flex h-11 items-center gap-2 rounded-xl border-[1.5px] border-dashed border-primary/50 px-4 text-[14px] font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
                                >
                                    <UserPlus aria-hidden className="size-4" />
                                    Assign {block.shift.role.toLowerCase()}
                                </button>
                            )),
                        )}
                    </div>

                    {expanded ? (
                        <div id={panelId} className="mt-4 flex flex-col gap-4 rounded-xl border bg-muted/20 px-4 py-3.5">
                            <p className="text-xs text-muted-foreground">
                                {item.siteName} · {longDate(date)}
                            </p>
                            {item.blocks.map((block) => (
                                <BlockDetails key={block.shift.id} block={block} itemName={item.name} onAssign={onAssign} onOpenShift={onOpenShift} onRemovePerson={onRemovePerson} />
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
                </div>
            </div>
        </li>
    );
}

/**
 * One day, as an agenda: pick a day from the week, see its events and services
 * in time order (overlapping ones at different sites side by side in the
 * list), and fill the gaps from the panel beside them. Rows stay short, so
 * eight or ten fit on a screen; one opens to show each role.
 */
export function DayPlan({
    ws,
    date,
    filter,
    onFilter,
    onDate,
    expanded,
    onToggle,
    assignShiftId,
    onAssign,
    onCloseAssign,
    run,
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
    /** The position being filled, or null. */
    assignShiftId: string | null;
    onAssign: (shiftId: string) => void;
    onCloseAssign: () => void;
    run: (plan: Plan) => Promise<boolean>;
    onOpenShift: (shiftId: string) => void;
    onAddShift: (prefill: AddShiftPrefill) => void;
    onRemovePerson: (shift: SchedulerShift, personId: string) => void;
    onEditEvent: (eventId: string) => void;
    /** One site in view: its name need not repeat on every row. */
    siteScoped: boolean;
}) {
    const everything = buildDayPlan(ws, date);
    const items = filter === "needs" ? everything.filter((i) => i.unfilled > 0) : everything;
    const days = unfilledByDay(ws);
    const assignShift = assignShiftId ? (ws.week.shifts.find((s) => s.id === assignShiftId) ?? null) : null;
    const assignItem = assignShift ? everything.find((i) => i.blocks.some((b) => b.shift.id === assignShift.id)) : undefined;

    return (
        <div className="flex flex-col gap-6">
            <nav aria-label="Days of the week" className="grid grid-cols-7 gap-2">
                {ws.week.days.map((day, index) => {
                    const selected = day.localDate === date;
                    const summary = days[index];
                    return (
                        <button
                            key={day.localDate}
                            type="button"
                            aria-current={selected ? "date" : undefined}
                            onClick={() => onDate(day.localDate)}
                            className={cn(
                                "flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                                selected ? "border-2 border-primary bg-primary/5" : "bg-card hover:bg-muted/50",
                            )}
                        >
                            <span className="text-[13px] text-muted-foreground">{weekdayShort(day.localDate)}</span>
                            <span className={cn("flex items-center gap-1 text-[22px] font-semibold leading-none tabular-nums", selected && "text-primary")}>
                                {dayOfMonth(day.localDate)}
                                {day.isToday ? <span aria-label="today" className="size-[7px] rounded-full bg-primary" /> : null}
                            </span>
                            <span className="mt-0.5 flex min-h-5 items-center justify-center">
                                {summary && summary.unfilled > 0 ? (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[12px] font-semibold text-amber-800">{summary.unfilled} open</span>
                                ) : summary && summary.items > 0 ? (
                                    <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                                        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
                                        {plural(summary.items, "shift")}
                                    </span>
                                ) : null}
                            </span>
                        </button>
                    );
                })}
            </nav>

            <div className={cn("grid gap-8", assignShift && "lg:grid-cols-[minmax(0,1fr)_24rem]")}>
                <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                        <h2 className="text-[26px] font-bold leading-tight tracking-tight">
                            {longDate(date)} <span className="ml-1 text-[17px] font-normal text-muted-foreground">{plural(everything.length, "shift")}</span>
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
                                Show all {plural(everything.length, "shift")}
                            </button>
                        </div>
                    ) : (
                        <ul className="border-y">
                            {items.map((item) => (
                                <AgendaRow
                                    key={item.key}
                                    item={item}
                                    date={date}
                                    showSite={!siteScoped}
                                    expanded={expanded.has(item.key)}
                                    assigning={assignShiftId}
                                    onToggle={() => onToggle(item.key)}
                                    onAssign={onAssign}
                                    onOpenShift={onOpenShift}
                                    onAddShift={onAddShift}
                                    onRemovePerson={onRemovePerson}
                                    onEditEvent={onEditEvent}
                                />
                            ))}
                        </ul>
                    )}
                </div>

                {assignShift ? <AssignPanel key={assignShift.id} ws={ws} shift={assignShift} title={assignItem?.name ?? assignShift.role} run={run} onClose={onCloseAssign} /> : null}
            </div>
        </div>
    );
}
