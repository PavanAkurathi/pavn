"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { SchedulerEvent, SchedulerPerson, SchedulerWeek } from "@repo/contracts/scheduler";
import { cn } from "@repo/ui/lib/utils";
import { compactRange, dayOfMonth, formatHours, weekdayShort } from "@/lib/scheduler/format";
import { roleColor } from "@/lib/scheduler/role-color";
import { hoursTone, type PeopleView, type PersonRow, type PositionRow } from "@/lib/scheduler/view-model";
import { ROSTERS_PATH } from "@/lib/routes";
import { ShiftChip } from "./shift-chip";
import styles from "./scheduler.module.css";

const MAX_CHIPS = 2;

const headerCell =
    "sticky top-0 z-20 flex min-h-[52px] flex-col justify-center gap-1 border-b border-r bg-muted px-2.5 py-1.5 text-xs";
const labelCell = "sticky left-0 z-10 flex min-w-0 items-center gap-2 border-b border-r bg-card px-2.5 py-1";
const dayCell = "relative flex min-h-[44px] min-w-0 flex-col justify-center gap-1 border-b border-r bg-card p-1";
const hoursCell = "flex flex-col items-end justify-center border-b bg-card px-2.5 py-1 tabular-nums";

function eventTone(e: SchedulerEvent) {
    if (e.needed === 0 || e.filled >= e.needed) return "border-emerald-600/60 text-emerald-800";
    if (e.filled / e.needed >= 0.5) return "border-amber-500/70 text-amber-800";
    return "border-destructive/60 text-destructive";
}

function Header({ week, corner, endLabel = "Hours" }: { week: SchedulerWeek; corner: React.ReactNode; endLabel?: string }) {
    return (
        <div role="row" className="contents">
            <div role="columnheader" className={cn(headerCell, "left-0 z-30")}>
                {corner}
            </div>
            {week.days.map((day) => {
                const events = week.events.filter((e) => e.dayIndex === day.index);
                return (
                    <div
                        key={day.localDate}
                        role="columnheader"
                        aria-label={`${weekdayShort(day.localDate)} ${day.localDate}${day.isToday ? ", today" : ""}`}
                        className={cn(headerCell, day.isToday && "shadow-[inset_0_-2px_0_var(--primary)]")}
                    >
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {weekdayShort(day.localDate)}
                            </span>
                            <span className={cn("text-[13.5px] font-semibold tabular-nums", day.isToday && "text-primary")}>
                                {dayOfMonth(day.localDate)}
                            </span>
                        </div>
                        {events.map((e) => (
                            <span
                                key={e.id}
                                title={`${e.name}, ${compactRange(e.startLocal, e.endLocal)}: ${e.filled} of ${e.needed} filled`}
                                className={cn(
                                    "flex max-w-full items-center gap-1 rounded-full border bg-card px-2 py-px text-[11px] font-semibold leading-4",
                                    eventTone(e),
                                )}
                            >
                                <span aria-hidden>◆</span>
                                <span className="min-w-0 truncate text-foreground">{e.name}</span>
                                <span className="ml-auto tabular-nums">
                                    {e.filled}/{e.needed}
                                </span>
                            </span>
                        ))}
                    </div>
                );
            })}
            <div role="columnheader" className={cn(headerCell, "items-end border-r-0")}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{endLabel}</span>
            </div>
        </div>
    );
}

function PersonLabel({ person }: { person: SchedulerPerson }) {
    return (
        <div role="rowheader" className={labelCell}>
            <span aria-hidden className={styles.dot} style={{ ["--rc" as string]: roleColor(person.primaryRole) }} />
            <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[13px] font-semibold">{person.name}</span>
                <span className="flex min-w-0 items-center gap-1.5 truncate text-[11.5px] text-muted-foreground">
                    {person.primaryRole ?? "No role yet"}
                    {person.kind === "invited" ? (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 text-[10px] font-semibold leading-4 text-amber-800">
                            Invited
                        </span>
                    ) : null}
                    {person.kind === "agency" ? (
                        <span
                            title={person.agencyName ?? undefined}
                            className="rounded-full border border-violet-300 bg-violet-50 px-1.5 text-[10px] font-semibold leading-4 text-violet-800"
                        >
                            Agency
                        </span>
                    ) : null}
                </span>
            </div>
        </div>
    );
}

function PersonRowCells({
    row,
    week,
    people,
}: {
    row: PersonRow;
    week: SchedulerWeek;
    people: Map<string, SchedulerPerson>;
}) {
    const { person } = row;
    const tone = hoursTone(person, week.settings.overtimePolicy);
    return (
        <div role="row" className="contents">
            <PersonLabel person={person} />
            {row.days.map((day, index) => {
                const unavailableTitle = day.unavailable.length
                    ? `Unavailable ${day.unavailable.map((s) => (s.wholeDay ? "all day" : compactRange(s.startLocal, s.endLocal))).join(", ")}`
                    : undefined;
                const hidden = day.shifts.length - MAX_CHIPS;
                return (
                    <div
                        key={index}
                        role="cell"
                        title={unavailableTitle}
                        className={cn(dayCell, day.unavailable.length > 0 && styles.unavailable)}
                    >
                        {day.unavailable.length ? <span className="sr-only">{unavailableTitle}</span> : null}
                        {day.timeOff.map((t) => (
                            <span
                                key={`${t.id}-${t.span.dayIndex}`}
                                className={cn(styles.off, t.status === "pending" && styles.offPending)}
                                title={[
                                    t.status === "approved" ? "Time off" : "Time off requested",
                                    t.span.wholeDay ? "all day" : compactRange(t.span.startLocal, t.span.endLocal),
                                    t.reason,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            >
                                <span className="sr-only">{t.status === "approved" ? "Time off" : "Time off requested"} </span>
                                <span aria-hidden>{t.status === "approved" ? "Off" : "Off?"}</span>
                                {t.span.wholeDay ? null : ` ${compactRange(t.span.startLocal, t.span.endLocal)}`}
                            </span>
                        ))}
                        {day.shifts.slice(0, MAX_CHIPS).map(({ shift, assignee }) => (
                            <ShiftChip
                                key={shift.id}
                                shift={shift}
                                people={people}
                                variant={{
                                    kind: "assignment",
                                    assignee,
                                    showRole: !person.primaryRole || shift.role.toLowerCase() !== person.primaryRole.toLowerCase(),
                                }}
                            />
                        ))}
                        {hidden > 0 ? (
                            <span className="px-1 text-[11px] font-medium text-muted-foreground">+{hidden} more</span>
                        ) : null}
                    </div>
                );
            })}
            <div role="cell" className={hoursCell}>
                <span
                    className={cn(
                        "text-[13px] font-semibold",
                        tone === "near" && "text-amber-700",
                        tone === "over" && "text-destructive",
                    )}
                >
                    {formatHours(person.scheduledMinutes)}
                </span>
                {tone === "over" ? (
                    <span className="text-[11px] font-semibold text-destructive">
                        {formatHours(person.overtimeMinutes)} OT
                    </span>
                ) : null}
            </div>
        </div>
    );
}

export function PeopleGrid({
    week,
    view,
    people,
    search,
    onSearch,
    collapsed,
    onToggleSection,
    flashOpenRow,
    openRowRef,
}: {
    week: SchedulerWeek;
    view: PeopleView;
    people: Map<string, SchedulerPerson>;
    search: string;
    onSearch: (value: string) => void;
    collapsed: Set<string>;
    onToggleSection: (id: string) => void;
    flashOpenRow: boolean;
    openRowRef: React.RefObject<HTMLDivElement | null>;
}) {
    const openTotal = view.open.flat().reduce((sum, s) => sum + s.open, 0);
    return (
        <div role="table" aria-label={`Schedule for ${week.location.name}`} className={styles.grid}>
            <Header
                week={week}
                corner={
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => onSearch(event.target.value)}
                        placeholder="Find person"
                        aria-label="Find a person"
                        className="h-8 w-full rounded-md border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                    />
                }
            />

            <div role="row" className="contents">
                <div role="rowheader" ref={openRowRef} className={cn(labelCell, "bg-muted/70", flashOpenRow && styles.flash)}>
                    <div className="flex flex-col leading-tight">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Open</span>
                        {openTotal ? (
                            <span className="text-[11.5px] font-medium text-destructive">{openTotal} to fill</span>
                        ) : null}
                    </div>
                </div>
                {view.open.map((shifts, index) => (
                    <div key={index} role="cell" className={cn(dayCell, "bg-muted/30", flashOpenRow && styles.flash)}>
                        {shifts.map((shift) => (
                            <ShiftChip key={shift.id} shift={shift} people={people} variant={{ kind: "open" }} />
                        ))}
                    </div>
                ))}
                <div role="cell" className={cn(hoursCell, "bg-muted/30")} />
            </div>

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
                                <ChevronDown
                                    aria-hidden
                                    className={cn("size-3.5 transition-transform", isCollapsed && "-rotate-90")}
                                />
                                {section.name}
                                <span className="font-normal text-muted-foreground">
                                    · {section.people.length} {section.people.length === 1 ? "person" : "people"}
                                </span>
                                {section.openSlots ? (
                                    <span className="font-semibold text-destructive">· {section.openSlots} open</span>
                                ) : null}
                                {isCollapsed ? (
                                    <span className="font-normal text-muted-foreground">· {formatHours(section.scheduledMinutes)}</span>
                                ) : null}
                            </button>
                        </div>
                        {isCollapsed
                            ? null
                            : section.people.map((row) => (
                                  <PersonRowCells key={row.person.id} row={row} week={week} people={people} />
                              ))}
                    </div>
                );
            })}

            {view.sections.length === 0 ? (
                <div role="row" className="col-span-full border-b bg-card px-4 py-6 text-sm text-muted-foreground">
                    {week.people.length === 0 ? (
                        <>
                            Nobody on the team yet.{" "}
                            <Link href={ROSTERS_PATH} className="font-medium text-primary underline-offset-2 hover:underline">
                                Add people in Roster
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

export function PositionsGrid({
    week,
    rows,
    people,
}: {
    week: SchedulerWeek;
    rows: PositionRow[];
    people: Map<string, SchedulerPerson>;
}) {
    return (
        <div role="table" aria-label={`Positions at ${week.location.name}`} className={styles.grid}>
            <Header
                week={week}
                corner={<span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Position</span>}
                endLabel="Filled"
            />
            {rows.map((row) => {
                const needed = row.days.flat().reduce((sum, s) => sum + (s.pendingRemoval ? 0 : s.capacity), 0);
                const filled = row.days.flat().reduce((sum, s) => sum + (s.pendingRemoval ? 0 : s.filled), 0);
                return (
                    <div key={row.role} role="row" className="contents">
                        <div role="rowheader" className={labelCell}>
                            <span aria-hidden className={styles.dot} style={{ ["--rc" as string]: roleColor(row.role) }} />
                            <div className="flex min-w-0 flex-col leading-tight">
                                <span className="truncate text-[13px] font-semibold">{row.role}</span>
                                <span className={cn("text-[11.5px]", row.open ? "font-medium text-destructive" : "text-muted-foreground")}>
                                    {row.open ? `${row.open} open` : "All filled"}
                                </span>
                            </div>
                        </div>
                        {row.days.map((shifts, index) => (
                            <div key={index} role="cell" className={dayCell}>
                                {shifts.map((shift) => (
                                    <ShiftChip key={shift.id} shift={shift} people={people} variant={{ kind: "position" }} />
                                ))}
                            </div>
                        ))}
                        <div role="cell" className={hoursCell}>
                            <span className={cn("text-[13px] font-semibold", filled < needed && "text-destructive")}>
                                {filled}/{needed}
                            </span>
                        </div>
                    </div>
                );
            })}
            {rows.length === 0 ? (
                <div role="row" className="col-span-full border-b bg-card px-4 py-6 text-sm text-muted-foreground">
                    No shifts this week.
                </div>
            ) : null}
        </div>
    );
}
