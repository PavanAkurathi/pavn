"use client";

import { useState } from "react";
import Link from "next/link";
import { useDroppable } from "@dnd-kit/core";
import { CalendarDays, ChevronDown, Plus, Search } from "lucide-react";
import type { SchedulerPerson, SchedulerShift, SchedulerWeek } from "@repo/contracts/scheduler";
import { InitialsAvatar } from "@repo/ui/components/app/initials-avatar";
import { ShiftCard } from "@repo/ui/components/app/shift-card";
import { roleHue } from "@repo/ui/lib/role-hue";
import { cn } from "@repo/ui/lib/utils";
import { clockRange, compactRange, dayOfMonth, formatHours, hoursLabel, longDate, weekdayShort } from "@/lib/scheduler/format";
import type { AddShiftPrefill } from "@/lib/scheduler/add-shift";
import type { DropTarget } from "@/lib/scheduler/plans";
import { hoursTone, type PeopleView, type PersonRow } from "@/lib/scheduler/view-model";
import type { UnfilledDay } from "@/lib/scheduler/workspace";
import { WORKERS_PATH } from "@/lib/routes";
import { ShiftChip, type ChipActions, type Density } from "./shift-chip";
import styles from "./scheduler.module.css";

const MAX_CHIPS = 2;

const headerCell = "sticky top-0 z-20 flex min-h-[56px] flex-col justify-center gap-1 border-b border-r bg-card px-3 py-2 text-sm";
const labelCell = "sticky left-0 z-10 flex min-w-0 items-center gap-3 border-b border-r bg-card px-3 py-2";
const dayCell =
    "group/cell relative flex min-h-[84px] min-w-0 cursor-cell flex-col justify-center gap-1.5 border-b border-r bg-card p-1.5 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--primary)]";

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

/** Hours on the schedule that day: each shift's paid time, once per person on it. */
function scheduledMinutesOn(week: SchedulerWeek, localDate: string) {
    return week.shifts
        .filter((shift) => shift.localDate === localDate && !shift.pendingRemoval)
        .reduce((sum, shift) => sum + shift.paidMinutes * shift.assignees.filter((a) => a.pendingState !== "remove").length, 0);
}

function Header({
    week,
    corner,
    unfilled,
    onOpenDay,
    onNeedsPeople,
}: {
    week: SchedulerWeek;
    corner: React.ReactNode;
    unfilled: UnfilledDay[];
    /** A date heading opens that day in the Day view. */
    onOpenDay: (dayIndex: number) => void;
    /** The "N open" pill opens that day, showing what needs people. */
    onNeedsPeople: (dayIndex: number) => void;
}) {
    return (
        <div role="row" className="contents">
            <div role="columnheader" className={cn(headerCell, "left-0 z-30 justify-center gap-1.5")}>
                {corner}
            </div>
            {week.days.map((day) => {
                const open = unfilled[day.index]?.unfilled ?? 0;
                return (
                    <div key={day.localDate} role="columnheader" aria-label={`${longDate(day.localDate)}${day.isToday ? ", today" : ""}`} className={headerCell}>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onOpenDay(day.index)}
                                title={`Open ${longDate(day.localDate)} in the Day view`}
                                className="-mx-1 flex items-baseline gap-1.5 rounded px-1 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                            >
                                <span className="text-[14px] font-semibold">{weekdayShort(day.localDate)}</span>
                                <span className={cn("text-[14px] font-semibold tabular-nums", day.isToday && "text-primary")}>{dayOfMonth(day.localDate)}</span>
                                {day.isToday ? <span aria-hidden className="size-[7px] self-center rounded-full bg-primary" /> : null}
                            </button>
                            {open > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => onNeedsPeople(day.index)}
                                    title="Open this day, showing what needs people"
                                    className="rounded-full bg-amber-100 px-2 py-0.5 text-[12px] font-semibold text-amber-800 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-primary"
                                >
                                    {open} open
                                </button>
                            ) : null}
                        </div>
                        <span className="text-[12px] tabular-nums text-muted-foreground">{formatHours(scheduledMinutesOn(week, day.localDate))} scheduled</span>
                    </div>
                );
            })}
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
                    className="absolute inset-1.5 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-transparent text-sm text-muted-foreground opacity-0 transition-opacity hover:border-border hover:bg-card hover:text-foreground focus-visible:border-primary focus-visible:text-primary focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary group-hover/cell:opacity-100"
                >
                    <Plus aria-hidden className="size-4" />
                    <span className="hidden group-hover/cell:inline group-focus-within/cell:inline">Add</span>
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
        <div role="rowheader" className={labelCell}>
            <InitialsAvatar name={person.name} size="lg" tone="soft" hue={roleHue(person.primaryRole)} />
            <div className="flex min-w-0 flex-col leading-snug">
                <span className="truncate text-[14.5px] font-semibold">{person.name}</span>
                <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] text-muted-foreground">
                    {person.primaryRole ?? "No role yet"}
                    {person.kind === "invited" ? <span className="rounded-full border bg-muted px-1.5 text-[10px] font-semibold leading-4 text-muted-foreground">No app yet</span> : null}
                    {person.kind === "agency" ? (
                        <span title={person.agencyName ?? undefined} className="rounded-full border bg-muted px-1.5 text-[10px] font-semibold leading-4 text-muted-foreground">
                            Agency
                        </span>
                    ) : null}
                </span>
                <span className={cn("text-[13px] tabular-nums text-muted-foreground", tone === "near" && "font-semibold text-amber-700", tone === "over" && "font-semibold text-destructive")}>
                    {hoursLabel(person.scheduledMinutes)}
                    {tone === "over" ? ` · ${hoursLabel(person.overtimeMinutes)} OT` : ""}
                </span>
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

const OPEN_CARDS_SHOWN = 2;

/** One open shift, in the Open shifts row: when, what, and the way to fill it. */
function OpenCard({ shift, eventName, siteName, onAssign }: { shift: SchedulerShift; eventName?: string; siteName?: string; onAssign: (shiftId: string) => void }) {
    const draft = shift.status === "draft";
    return (
        <div className={cn("relative rounded-lg bg-[#fdebd3] px-2.5 py-2 text-left leading-tight", draft && "border border-dashed border-orange-400/70")}>
            {draft ? <span className="absolute right-1.5 top-1 text-[10px] font-bold text-orange-800">Draft</span> : null}
            <span className="block text-[13px] font-bold tabular-nums">{clockRange(shift.startLocal, shift.endLocal)}{shift.overnight ? " +1" : ""}</span>
            {eventName ? <span className="mt-0.5 block truncate text-[12px] text-foreground/85">{eventName}</span> : null}
            <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
                {shift.role}
                {shift.open > 1 ? ` · ${shift.open} needed` : ""}
                {siteName ? ` · ${siteName}` : ""}
                {" · "}
                <button
                    type="button"
                    onClick={() => onAssign(shift.id)}
                    className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                    aria-label={`Assign ${shift.role}, ${clockRange(shift.startLocal, shift.endLocal)}`}
                >
                    Assign
                </button>
            </span>
        </div>
    );
}

/** What still needs people, per day, as a few compact cards: the rest are one click away in the Day plan. */
function OpenRow({
    openShifts,
    editing,
    onAssign,
    onNeedsPeople,
}: {
    openShifts: SchedulerShift[][];
    editing: GridEditing;
    onAssign: (shiftId: string) => void;
    onNeedsPeople: (dayIndex: number) => void;
}) {
    return (
        <div role="row" className="contents">
            <div role="rowheader" className={cn(labelCell, "bg-[#fff6ea]")}>
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fdebd3] text-orange-700">
                    <CalendarDays className="size-5" />
                </span>
                <span className="text-[14.5px] font-semibold">Open shifts</span>
            </div>
            {openShifts.map((shifts, index) => {
                const hidden = shifts.length - OPEN_CARDS_SHOWN;
                return (
                    <div key={index} role="cell" className="flex min-h-[64px] min-w-0 flex-col justify-center gap-1.5 border-b border-r bg-[#fff6ea] p-1.5">
                        {shifts.slice(0, OPEN_CARDS_SHOWN).map((shift) => (
                            <OpenCard
                                key={shift.id}
                                shift={shift}
                                eventName={shift.eventId ? editing.eventNames.get(shift.eventId) : undefined}
                                siteName={editing.showSite ? editing.siteNames.get(shift.locationId) : undefined}
                                onAssign={onAssign}
                            />
                        ))}
                        {hidden > 0 ? (
                            <button
                                type="button"
                                onClick={() => onNeedsPeople(index)}
                                className="w-fit rounded px-1 text-left text-[11.5px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                            >
                                +{hidden} more open
                            </button>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

export function PeopleGrid({
    week,
    view,
    unfilled,
    openShifts,
    search,
    onSearch,
    collapsed,
    onToggleSection,
    onOpenDay,
    onNeedsPeople,
    onAssign,
    editing,
    title,
}: {
    week: SchedulerWeek;
    view: PeopleView;
    unfilled: UnfilledDay[];
    openShifts: SchedulerShift[][];
    search: string;
    onSearch: (value: string) => void;
    collapsed: Set<string>;
    onToggleSection: (id: string) => void;
    onOpenDay: (dayIndex: number) => void;
    onNeedsPeople: (dayIndex: number) => void;
    /** Assign someone to an open shift: opens it in the Day view. */
    onAssign: (shiftId: string) => void;
    editing: GridEditing;
    /** What the corner says: "People", or a control in its place. */
    title?: React.ReactNode;
}) {
    let rowIndex = -1;
    // A short team needs no search; a long one does.
    const searchable = week.people.length > 12 || search.length > 0;
    return (
        <div role="table" aria-label={`Team week, ${week.location.name}`} className={styles.grid} onKeyDown={moveCellFocus}>
            <Header
                week={week}
                unfilled={unfilled}
                onOpenDay={onOpenDay}
                onNeedsPeople={onNeedsPeople}
                corner={
                    <>
                        {title ?? <span className="text-[14px] font-semibold">People</span>}
                        {searchable ? (
                            <div className="relative">
                                <Search aria-hidden className="pointer-events-none absolute left-2 top-2 size-3.5 text-muted-foreground" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => onSearch(event.target.value)}
                                    placeholder="Find person"
                                    aria-label="Find a person"
                                    className="h-7 w-full rounded-md border bg-card pl-7 pr-2 text-[12.5px] font-normal outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                                />
                            </div>
                        ) : null}
                    </>
                }
            />

            <OpenRow openShifts={openShifts} editing={editing} onAssign={onAssign} onNeedsPeople={onNeedsPeople} />

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
                                {isCollapsed ? <span className="font-normal text-muted-foreground">· {hoursLabel(section.scheduledMinutes)}</span> : null}
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
                            <Link href={WORKERS_PATH} className="font-medium text-primary underline-offset-2 hover:underline">
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

/**
 * The week by position instead of by person: one row per role, each day's
 * shifts for it with who is on them and how full they are. A shift opens the
 * same editor; an empty spot adds a shift for that role on that day.
 */
export function PositionsGrid({
    week,
    unfilled,
    eventNames,
    onOpenDay,
    onNeedsPeople,
    onOpenShift,
    onAddShift,
    title,
}: {
    week: SchedulerWeek;
    unfilled: UnfilledDay[];
    eventNames: Map<string, string>;
    /** What the corner says: "Positions", or a control in its place. */
    title?: React.ReactNode;
    onOpenDay: (dayIndex: number) => void;
    onNeedsPeople: (dayIndex: number) => void;
    onOpenShift: (shiftId: string) => void;
    onAddShift: (prefill: AddShiftPrefill) => void;
}) {
    const names = new Map(week.people.map((p) => [p.id, p.name]));
    const live = week.shifts.filter((shift) => !shift.pendingRemoval);
    // Roles on the schedule this week, and the team's own roles, so an empty role can still get its first shift.
    const roles = [...new Set([...live.map((s) => s.role), ...week.people.map((p) => p.primaryRole).filter((r): r is string => Boolean(r))])].sort((a, b) =>
        a.localeCompare(b),
    );

    return (
        <div role="table" aria-label={`Week by position, ${week.location.name}`} className={styles.grid}>
            <Header week={week} unfilled={unfilled} onOpenDay={onOpenDay} onNeedsPeople={onNeedsPeople} corner={title ?? <span className="text-[14px] font-semibold">Positions</span>} />
            {roles.map((role) => (
                <div key={role} role="row" className="contents">
                    <div role="rowheader" className={labelCell}>
                        <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: roleHue(role) }} />
                        <span className="truncate text-[14.5px] font-semibold">{role}</span>
                    </div>
                    {week.days.map((day) => {
                        const shifts = live.filter((s) => s.role === role && s.localDate === day.localDate).sort((a, b) => a.startLocal.localeCompare(b.startLocal));
                        return (
                            <div
                                key={day.localDate}
                                role="cell"
                                className={dayCell}
                                onClick={(event) => {
                                    if ((event.target as HTMLElement).closest("button")) return;
                                    onAddShift({ localDate: day.localDate, role });
                                }}
                            >
                                {shifts.map((shift) => {
                                    const people = shift.assignees.filter((a) => a.pendingState !== "remove").map((a) => (names.get(a.personId) ?? "Someone").split(" ")[0]);
                                    return (
                                        <ShiftCard
                                            key={shift.id}
                                            leadWith="time"
                                            time={clockRange(shift.startLocal, shift.endLocal)}
                                            overnight={shift.overnight}
                                            title={`${people.length ? people.join(", ") : "Nobody yet"}${shift.open > 0 ? ` · ${shift.open} open` : ""}`}
                                            subtitle={shift.eventId ? eventNames.get(shift.eventId) : undefined}
                                            detail={`${shift.filled}/${shift.capacity}`}
                                            hue={roleHue(role)}
                                            draft={shift.status === "draft"}
                                            edited={shift.hasUnpublishedEdits}
                                            event={Boolean(shift.eventId)}
                                            density="comfortable"
                                            onClick={() => onOpenShift(shift.id)}
                                        />
                                    );
                                })}
                                {shifts.length === 0 ? (
                                    <button
                                        type="button"
                                        aria-label={`Add a ${role} shift on ${longDate(day.localDate)}`}
                                        onClick={() => onAddShift({ localDate: day.localDate, role })}
                                        className="absolute inset-1.5 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-transparent text-sm text-muted-foreground opacity-0 transition-opacity hover:border-border hover:bg-card hover:text-foreground focus-visible:border-primary focus-visible:text-primary focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary group-hover/cell:opacity-100"
                                    >
                                        <Plus aria-hidden className="size-4" />
                                        <span className="hidden group-hover/cell:inline group-focus-within/cell:inline">Add</span>
                                    </button>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            ))}
            {roles.length === 0 ? (
                <div role="row" className="col-span-full border-b bg-card px-4 py-6 text-sm text-muted-foreground">
                    No positions yet. Add a shift, or give your team their roles in Team.
                </div>
            ) : null}
        </div>
    );
}
