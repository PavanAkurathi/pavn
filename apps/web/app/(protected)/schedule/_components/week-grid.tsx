"use client";

import { useState } from "react";
import Link from "next/link";
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, Plus } from "lucide-react";
import type { SchedulerPerson, SchedulerWeek } from "@repo/contracts/scheduler";
import { InitialsAvatar } from "@repo/ui/components/app/initials-avatar";
import { cn } from "@repo/ui/lib/utils";
import { compactRange, dayOfMonth, formatHours, longDate, weekdayShort } from "@/lib/scheduler/format";
import type { DropTarget } from "@/lib/scheduler/plans";
import { hoursTone, type PeopleView, type PersonRow } from "@/lib/scheduler/view-model";
import type { UnfilledDay } from "@/lib/scheduler/workspace";
import { ROSTERS_PATH } from "@/lib/routes";
import { ShiftChip, type ChipActions, type Density } from "./shift-chip";
import styles from "./scheduler.module.css";

const MAX_CHIPS = 2;

const headerCell = "sticky top-0 z-20 flex min-h-[52px] flex-col justify-center gap-1 border-b border-r bg-muted px-2.5 py-1.5 text-xs";
const labelCell = "sticky left-0 z-10 flex min-w-0 items-center gap-2 border-b border-r bg-card px-2.5 py-1";
const dayCell =
    "group/cell relative flex min-h-[64px] min-w-0 cursor-cell flex-col justify-center gap-1 border-b border-r bg-card p-1 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--primary)]";

export interface DropHint {
    tone: "ok" | "warn" | "block";
    message?: string;
}

export interface GridEditing {
    chips: ChipActions;
    /** Click or Enter on a cell, or its plus: add a shift for that person on that day. */
    onAddAt: (target: DropTarget) => void;
    /** "v" on a cell: paste what "c" copied. */
    onPasteAt: (target: DropTarget) => void;
    /** While dragging: what dropping here would mean. */
    hintFor: (target: DropTarget) => DropHint | null;
    dragging: boolean;
    /** Comfortable entries, or one line each for a big team. */
    density: Density;
    /** Several sites are in view, so entries say where. */
    showSite: boolean;
    siteNames: Map<string, string>;
    eventNames: Map<string, string>;
}

/** Arrow keys walk the cells; Home/End jump along the row. */
export function moveCellFocus(event: React.KeyboardEvent<HTMLElement>) {
    const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-cell]");
    if (!cell || (event.target as HTMLElement).closest("[data-chip]")) return;
    const [row, col] = cell.dataset.cell!.split(",").map(Number) as [number, number];
    const moves: Record<string, [number, number]> = {
        ArrowUp: [row - 1, col],
        ArrowDown: [row + 1, col],
        ArrowLeft: [row, col - 1],
        ArrowRight: [row, col + 1],
        Home: [row, 0],
        End: [row, 6],
    };
    const next = moves[event.key];
    if (!next) return;
    const target = event.currentTarget.querySelector<HTMLElement>(`[data-cell="${next[0]},${next[1]}"]`);
    if (target) {
        event.preventDefault();
        target.focus();
    }
}

function Header({
    week,
    corner,
    onOpenDay,
}: {
    week: SchedulerWeek;
    corner: React.ReactNode;
    /** A date heading opens that day in the Day plan. */
    onOpenDay: (dayIndex: number) => void;
}) {
    return (
        <div role="row" className="contents">
            <div role="columnheader" className={cn(headerCell, "left-0 z-30 gap-1.5")}>
                {corner}
            </div>
            {week.days.map((day) => (
                <div key={day.localDate} role="columnheader" aria-label={`${longDate(day.localDate)}${day.isToday ? ", today" : ""}`} className={headerCell}>
                    <button
                        type="button"
                        onClick={() => onOpenDay(day.index)}
                        title={`Open ${longDate(day.localDate)} in the Day plan`}
                        className="-mx-1 flex items-baseline gap-1.5 rounded px-1 text-left hover:bg-card focus-visible:outline-2 focus-visible:outline-primary"
                    >
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{weekdayShort(day.localDate)}</span>
                        <span className={cn("text-[13.5px] font-semibold tabular-nums", day.isToday && "text-primary")}>{dayOfMonth(day.localDate)}</span>
                        {day.isToday ? <span aria-hidden className="size-[7px] self-center rounded-full bg-primary" /> : null}
                    </button>
                </div>
            ))}
        </div>
    );
}

/** A day cell you can click to add to, drop onto, and paste into. */
function DayCell({
    target,
    position,
    editing,
    className,
    title,
    addLabel,
    children,
}: {
    target: DropTarget;
    /** Row and column for arrow-key focus. */
    position: [number, number];
    editing: GridEditing;
    className?: string;
    title?: string;
    /** What the visible plus says to a screen reader. */
    addLabel: string;
    children: React.ReactNode;
}) {
    const id = `cell:${target.personId ?? "open"}:${target.dayIndex}`;
    const { setNodeRef, isOver } = useDroppable({ id, data: { target } });
    const hint = isOver ? editing.hintFor(target) : null;
    const empty = !children || (Array.isArray(children) && children.every((c) => !c || (Array.isArray(c) && c.length === 0)));

    return (
        <div
            ref={setNodeRef}
            role="cell"
            tabIndex={position[0] === 0 && position[1] === 0 ? 0 : -1}
            data-cell={`${position[0]},${position[1]}`}
            title={title}
            onClick={(event) => {
                if ((event.target as HTMLElement).closest("[data-chip],button")) return;
                editing.onAddAt(target);
            }}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter") {
                    event.preventDefault();
                    const chip = event.currentTarget.querySelector<HTMLElement>("[data-chip]");
                    if (chip) chip.click();
                    else editing.onAddAt(target);
                } else if (event.key === "v" && !event.metaKey && !event.ctrlKey) {
                    editing.onPasteAt(target);
                }
            }}
            className={cn(
                dayCell,
                className,
                hint?.tone === "ok" && "shadow-[inset_0_0_0_2px_#047857] bg-emerald-50",
                hint?.tone === "warn" && "shadow-[inset_0_0_0_2px_#d97706]",
                hint?.tone === "block" && "shadow-[inset_0_0_0_2px_var(--destructive)]",
            )}
        >
            {children}
            {empty && !editing.dragging ? (
                <button
                    type="button"
                    aria-label={addLabel}
                    onClick={() => editing.onAddAt(target)}
                    className="absolute inset-1 grid place-items-center rounded-md border border-transparent text-muted-foreground/45 transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:border-primary focus-visible:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                >
                    <Plus aria-hidden className="size-4" />
                </button>
            ) : null}
            {hint?.message ? (
                <span
                    className={cn(
                        "pointer-events-none absolute inset-x-1 bottom-[calc(100%-4px)] z-30 rounded border bg-card px-1.5 py-0.5 text-[10.5px] font-semibold leading-tight shadow-sm",
                        hint.tone === "block" ? "text-destructive" : hint.tone === "warn" ? "text-amber-700" : "text-emerald-700",
                    )}
                >
                    {hint.message}
                </span>
            ) : null}
        </div>
    );
}

function PersonLabel({ person, policy }: { person: SchedulerPerson; policy: SchedulerWeek["settings"]["overtimePolicy"] }) {
    const tone = hoursTone(person, policy);
    return (
        <div role="rowheader" className={cn(labelCell, "justify-between gap-2")}>
            <div className="flex min-w-0 items-center gap-2">
                <InitialsAvatar name={person.name} size="sm" />
                <div className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-[13px] font-semibold">{person.name}</span>
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-[11.5px] text-muted-foreground">
                        {person.primaryRole ?? "No role yet"}
                        {person.kind === "invited" ? <span className="rounded-full border bg-muted px-1.5 text-[10px] font-semibold leading-4 text-muted-foreground">Invited</span> : null}
                        {person.kind === "agency" ? (
                            <span title={person.agencyName ?? undefined} className="rounded-full border bg-muted px-1.5 text-[10px] font-semibold leading-4 text-muted-foreground">
                                Agency
                            </span>
                        ) : null}
                    </span>
                </div>
            </div>
            <div className="flex shrink-0 flex-col items-end leading-tight tabular-nums">
                <span className={cn("text-[13px] font-semibold", tone === "near" && "text-amber-700", tone === "over" && "text-destructive")}>
                    {formatHours(person.scheduledMinutes)}
                </span>
                {tone === "over" ? <span className="text-[11px] font-semibold text-destructive">{formatHours(person.overtimeMinutes)} OT</span> : null}
            </div>
        </div>
    );
}

function PersonDayCell({
    person,
    row,
    index,
    rowIndex,
    week,
    editing,
}: {
    person: SchedulerPerson;
    row: PersonRow;
    index: number;
    rowIndex: number;
    week: SchedulerWeek;
    editing: GridEditing;
}) {
    const day = row.days[index]!;
    const [showAll, setShowAll] = useState(false);
    const date = week.days[index]!.localDate;
    const unavailableTitle = day.unavailable.length
        ? `Unavailable ${day.unavailable.map((s) => (s.wholeDay ? "all day" : compactRange(s.startLocal, s.endLocal))).join(", ")}`
        : undefined;
    const shown = showAll ? day.shifts : day.shifts.slice(0, MAX_CHIPS);
    const hidden = day.shifts.length - shown.length;

    return (
        <DayCell
            target={{ personId: person.id, dayIndex: index }}
            position={[rowIndex, index]}
            editing={editing}
            title={unavailableTitle}
            addLabel={`Add a shift for ${person.name} on ${longDate(date)}`}
            className={cn(day.unavailable.length > 0 && styles.unavailable)}
        >
            {day.unavailable.length ? <span className="sr-only">{unavailableTitle}</span> : null}
            {day.timeOff.map((t) => (
                <span
                    key={`${t.id}-${t.span.dayIndex}`}
                    className={cn(styles.off, t.status === "pending" && styles.offPending)}
                    title={[t.status === "approved" ? "Time off" : "Time off requested", t.span.wholeDay ? "all day" : compactRange(t.span.startLocal, t.span.endLocal), t.reason]
                        .filter(Boolean)
                        .join(" · ")}
                >
                    <span className="sr-only">{t.status === "approved" ? "Time off" : "Time off requested"} </span>
                    <span aria-hidden>{t.status === "approved" ? "Off" : "Off?"}</span>
                    {t.span.wholeDay ? null : ` ${compactRange(t.span.startLocal, t.span.endLocal)}`}
                </span>
            ))}
            {shown.map(({ shift, assignee }) => (
                <ShiftChip
                    key={shift.id}
                    shift={shift}
                    assignee={assignee}
                    actions={editing.chips}
                    dragId={`chip:${shift.id}:${person.id}`}
                    density={editing.density}
                    eventName={shift.eventId ? editing.eventNames.get(shift.eventId) : undefined}
                    siteName={editing.showSite ? editing.siteNames.get(shift.locationId) : undefined}
                />
            ))}
            {hidden > 0 || showAll ? (
                <button
                    type="button"
                    onClick={() => setShowAll((open) => !open)}
                    aria-expanded={showAll}
                    className="w-fit rounded px-1 text-left text-[11px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                >
                    {showAll ? "Show fewer" : `+${hidden} more`}
                </button>
            ) : null}
        </DayCell>
    );
}

/** The one compact row of what still needs people, per day, instead of a card for every empty position. */
function UnfilledRow({ unfilled, week, onNeedsPeople }: { unfilled: UnfilledDay[]; week: SchedulerWeek; onNeedsPeople: (dayIndex: number) => void }) {
    const total = unfilled.reduce((sum, d) => sum + d.unfilled, 0);
    return (
        <div role="row" className="contents">
            <div role="rowheader" className={cn(labelCell, "bg-muted/70")}>
                <div className="flex flex-col leading-tight">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unfilled positions</span>
                    <span className="text-[11.5px] font-medium text-muted-foreground">{total > 0 ? `${total} this week` : "None this week"}</span>
                </div>
            </div>
            {unfilled.map((day, index) => (
                <div key={index} role="cell" className="flex min-h-[44px] items-center border-b border-r bg-muted/30 px-2">
                    {day.unfilled > 0 ? (
                        <button
                            type="button"
                            onClick={() => onNeedsPeople(index)}
                            title="Open this day in the Day plan, showing events that need people"
                            className="rounded px-1 py-0.5 text-left text-[12px] font-semibold text-foreground hover:bg-card hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                        >
                            {day.unfilled} unfilled · {day.events} {day.events === 1 ? "event" : "events"}
                            <span className="sr-only"> on {longDate(week.days[index]!.localDate)}</span>
                        </button>
                    ) : (
                        <span className="px-1 text-[12px] text-muted-foreground">All filled</span>
                    )}
                </div>
            ))}
        </div>
    );
}

export function PeopleGrid({
    week,
    view,
    unfilled,
    search,
    onSearch,
    collapsed,
    onToggleSection,
    onOpenDay,
    onNeedsPeople,
    editing,
}: {
    week: SchedulerWeek;
    view: PeopleView;
    unfilled: UnfilledDay[];
    search: string;
    onSearch: (value: string) => void;
    collapsed: Set<string>;
    onToggleSection: (id: string) => void;
    onOpenDay: (dayIndex: number) => void;
    onNeedsPeople: (dayIndex: number) => void;
    editing: GridEditing;
}) {
    let rowIndex = -1;
    return (
        <div role="table" aria-label={`Team week, ${week.location.name}`} className={styles.grid} onKeyDown={moveCellFocus}>
            <Header
                week={week}
                onOpenDay={onOpenDay}
                corner={
                    <>
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => onSearch(event.target.value)}
                            placeholder="Find person"
                            aria-label="Find a person"
                            className="h-8 w-full rounded-md border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                        />
                        <span className="text-[11px] font-normal text-muted-foreground">Hours are this week, at every site</span>
                    </>
                }
            />

            <UnfilledRow unfilled={unfilled} week={week} onNeedsPeople={onNeedsPeople} />

            {view.sections.map((section) => {
                const isCollapsed = collapsed.has(section.id);
                return (
                    <div key={section.id} role="rowgroup" className="contents">
                        <div role="row" className="col-span-full flex border-b bg-muted">
                            <button
                                type="button"
                                aria-expanded={!isCollapsed}
                                onClick={() => onToggleSection(section.id)}
                                className="sticky left-0 inline-flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-foreground/80 hover:text-foreground"
                            >
                                <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", isCollapsed && "-rotate-90")} />
                                {section.name}
                                <span className="font-normal text-muted-foreground">
                                    · {section.people.length} {section.people.length === 1 ? "person" : "people"}
                                </span>
                                {isCollapsed ? <span className="font-normal text-muted-foreground">· {formatHours(section.scheduledMinutes)}</span> : null}
                            </button>
                        </div>
                        {isCollapsed
                            ? null
                            : section.people.map((row) => {
                                  const index = ++rowIndex;
                                  return (
                                      <div key={row.person.id} role="row" className="contents">
                                          <PersonLabel person={row.person} policy={week.settings.overtimePolicy} />
                                          {row.days.map((_, dayIndex) => (
                                              <PersonDayCell key={dayIndex} person={row.person} row={row} index={dayIndex} rowIndex={index} week={week} editing={editing} />
                                          ))}
                                      </div>
                                  );
                              })}
                    </div>
                );
            })}

            {view.sections.length === 0 ? (
                <div role="row" className="col-span-full border-b bg-card px-4 py-6 text-sm text-muted-foreground">
                    {week.people.length === 0 ? (
                        <>
                            Nobody on the team yet.{" "}
                            <Link href={ROSTERS_PATH} className="font-medium text-primary underline-offset-2 hover:underline">
                                Add people in Team
                            </Link>
                        </>
                    ) : search.trim() ? (
                        <>Nobody matches &ldquo;{search.trim()}&rdquo;.</>
                    ) : (
                        <>Nobody in this department yet.</>
                    )}
                </div>
            ) : null}
        </div>
    );
}
