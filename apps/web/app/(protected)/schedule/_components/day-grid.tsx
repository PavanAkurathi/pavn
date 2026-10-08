"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, Plus } from "lucide-react";
import type { SchedulerShift, SchedulerWeek } from "@repo/contracts/scheduler";
import { InitialsAvatar } from "@repo/ui/components/app/initials-avatar";
import { ShiftCard } from "@repo/ui/components/app/shift-card";
import { roleHue } from "@repo/ui/lib/role-hue";
import { cn } from "@repo/ui/lib/utils";
import type { AddShiftPrefill } from "@/lib/scheduler/add-shift";
import { hourRange, hourToLocal, minutesNow, minutesOf, packLanes, placeSpan, spanOf } from "@/lib/scheduler/day-timeline";
import { clockRange, compactTime, formatHours, longDate } from "@/lib/scheduler/format";
import type { PeopleView } from "@/lib/scheduler/view-model";
import { WORKERS_PATH } from "@/lib/routes";
import styles from "./scheduler.module.css";

/** Height of one stacked shift, and the gap around it. */
const LANE = 56;
const PAD = 6;
/** A click on an empty hour starts a shift that long. */
const NEW_SHIFT_HOURS = 6;
/** Narrowest an hour gets before the grid scrolls sideways. */
const MIN_HOUR_PX = 56;

interface Bar {
    key: string;
    shift: SchedulerShift;
    span: { start: number; end: number };
    title: string;
    detail?: string;
    removed?: boolean;
    edited?: boolean;
    conflict?: boolean;
}

interface Mark {
    key: string;
    span: { start: number; end: number };
    label: string;
    tone: "off" | "offPending" | "unavailable";
}

interface Row {
    key: string;
    label: React.ReactNode;
    bars: Bar[];
    marks: Mark[];
    /** What a click at this hour adds. */
    prefill: (hour: number) => AddShiftPrefill;
    addLabel: string;
    tint?: string;
}

const labelCell = "sticky left-0 z-10 flex min-w-0 items-center gap-3 border-b border-r bg-card px-3 py-2";

/** The site's minutes since midnight while the day on screen is today, so the "now" line moves; null otherwise. */
function useMinutesNow(timeZone: string, enabled: boolean) {
    const subscribe = useCallback((onChange: () => void) => {
        const timer = window.setInterval(onChange, 30_000);
        return () => window.clearInterval(timer);
    }, []);
    return useSyncExternalStore(
        subscribe,
        () => (enabled ? minutesNow(timeZone) : null),
        () => null,
    );
}

/**
 * One day as a spreadsheet: people (or positions) down the side, the hours
 * across, each shift a bar from its start to its end. Overlapping shifts stack
 * in their row. A bar opens the shift; an empty hour adds one starting there.
 */
export function DayGrid({
    week,
    date,
    today,
    groupBy,
    title,
    peopleView,
    collapsed,
    onToggleSection,
    eventNames,
    siteNames,
    loading,
    onOpenShift,
    onAddShift,
}: {
    week: SchedulerWeek;
    date: string;
    today: string;
    groupBy: "people" | "positions";
    /** The corner: the Group by control. */
    title: React.ReactNode;
    peopleView: PeopleView;
    collapsed: Set<string>;
    onToggleSection: (id: string) => void;
    eventNames: Map<string, string>;
    /** Set when several sites are in view, so a bar says where. */
    siteNames: Map<string, string> | null;
    loading: boolean;
    onOpenShift: (shiftId: string) => void;
    onAddShift: (prefill: AddShiftPrefill) => void;
}) {
    const [hover, setHover] = useState<{ row: string; hour: number } | null>(null);
    const dayIndex = week.days.findIndex((d) => d.localDate === date);
    const dayShifts = week.shifts.filter((s) => s.localDate === date);
    const live = dayShifts.filter((s) => !s.pendingRemoval);
    const range = hourRange(live.map((s) => spanOf(s.startLocal, s.endLocal)));
    const hours = range.to - range.from;
    const now = useMinutesNow(week.location.timezone, date === today);
    const names = new Map(week.people.map((p) => [p.id, p.name]));
    const at = (hour: number) => ({ localDate: date, startLocal: hourToLocal(hour), endLocal: hourToLocal(hour + NEW_SHIFT_HOURS) });
    const nameOf = (shift: SchedulerShift) => (shift.eventId && eventNames.get(shift.eventId)) || shift.role;

    const scheduled = live.reduce((sum, s) => sum + s.paidMinutes * s.assignees.filter((a) => a.pendingState !== "remove").length, 0);
    const open = live.reduce((sum, s) => sum + s.open, 0);

    // ---- The rows ------------------------------------------------------------
    const sections: { id: string | null; name: string; count: number; rows: Row[] }[] = [];
    if (groupBy === "people") {
        const openShifts = dayIndex >= 0 ? (peopleView.open[dayIndex] ?? []) : [];
        sections.push({
            id: null,
            name: "",
            count: 0,
            rows: [
                {
                    key: "open",
                    tint: "bg-[#fff6ea]",
                    label: (
                        <>
                            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fdebd3] text-orange-700">
                                <CalendarDays className="size-5" />
                            </span>
                            <span className="text-[14.5px] font-semibold">Open shifts</span>
                        </>
                    ),
                    bars: openShifts.map((shift) => ({
                        key: shift.id,
                        shift,
                        span: spanOf(shift.startLocal, shift.endLocal),
                        title: `${nameOf(shift)} · ${shift.open} open`,
                        edited: shift.hasUnpublishedEdits,
                    })),
                    marks: [],
                    prefill: (hour) => at(hour),
                    addLabel: `Add an open shift on ${longDate(date)}`,
                },
            ],
        });
        for (const section of peopleView.sections) {
            sections.push({
                id: section.id,
                name: section.name,
                count: section.people.length,
                rows: section.people.map(({ person, days }) => {
                    const day = dayIndex >= 0 ? days[dayIndex] : undefined;
                    const bars: Bar[] = (day?.shifts ?? [])
                        .filter(({ shift }) => shift.localDate === date)
                        .map(({ shift, assignee }) => ({
                            key: shift.id,
                            shift,
                            span: spanOf(shift.startLocal, shift.endLocal),
                            title: nameOf(shift),
                            removed: shift.pendingRemoval || assignee.pendingState === "remove",
                            edited: shift.hasUnpublishedEdits || assignee.pendingState === "add",
                            conflict: assignee.warnings.some((w) => w.severity === "block"),
                        }));
                    const minutes = bars.filter((b) => !b.removed).reduce((sum, b) => sum + b.shift.paidMinutes, 0);
                    const marks: Mark[] = [
                        ...(day?.timeOff ?? []).map((t, i) => ({
                            key: `off-${t.id}-${i}`,
                            span: t.span.wholeDay ? { start: 0, end: 48 * 60 } : { start: minutesOf(t.span.startLocal), end: minutesOf(t.span.endLocal) },
                            label: t.status === "approved" ? "Time off" : "Time off requested",
                            tone: t.status === "approved" ? ("off" as const) : ("offPending" as const),
                        })),
                        ...(day?.unavailable ?? []).map((u, i) => ({
                            key: `na-${i}`,
                            span: u.wholeDay ? { start: 0, end: 48 * 60 } : { start: minutesOf(u.startLocal), end: minutesOf(u.endLocal) },
                            label: "Unavailable",
                            tone: "unavailable" as const,
                        })),
                    ];
                    return {
                        key: person.id,
                        label: (
                            <>
                                <InitialsAvatar name={person.name} size="lg" tone="soft" hue={roleHue(person.primaryRole)} />
                                <span className="flex min-w-0 flex-col leading-snug">
                                    <span className="truncate text-[14.5px] font-semibold">{person.name}</span>
                                    <span className="truncate text-[13px] tabular-nums text-muted-foreground">
                                        {minutes > 0 ? formatHours(minutes) : (person.primaryRole ?? "No role yet")}
                                    </span>
                                </span>
                            </>
                        ),
                        bars,
                        marks,
                        prefill: (hour) => ({ ...at(hour), person, role: person.primaryRole ?? undefined }),
                        addLabel: `Add a shift for ${person.name} on ${longDate(date)}`,
                    };
                }),
            });
        }
    } else {
        // Roles on the schedule today, and the team's own roles, so an empty role can still get its first shift.
        const roles = [...new Set([...live.map((s) => s.role), ...week.people.map((p) => p.primaryRole).filter((r): r is string => Boolean(r))])].sort((a, b) =>
            a.localeCompare(b),
        );
        sections.push({
            id: null,
            name: "",
            count: 0,
            rows: roles.map((role) => {
                const shifts = live.filter((s) => s.role === role);
                return {
                    key: role,
                    label: (
                        <>
                            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: roleHue(role) }} />
                            <span className="truncate text-[14.5px] font-semibold">{role}</span>
                        </>
                    ),
                    bars: shifts.map((shift) => {
                        const people = shift.assignees.filter((a) => a.pendingState !== "remove").map((a) => (names.get(a.personId) ?? "Someone").split(" ")[0]);
                        return {
                            key: shift.id,
                            shift,
                            span: spanOf(shift.startLocal, shift.endLocal),
                            title: `${people.length ? people.join(", ") : "Nobody yet"}${shift.open > 0 ? ` · ${shift.open} open` : ""}`,
                            detail: `${shift.filled}/${shift.capacity}`,
                            edited: shift.hasUnpublishedEdits,
                        };
                    }),
                    marks: [],
                    prefill: (hour) => ({ ...at(hour), role }),
                    addLabel: `Add a ${role} shift on ${longDate(date)}`,
                };
            }),
        });
    }

    // ---- Drawing ---------------------------------------------------------------
    const pct = (value: number) => `${value}%`;
    const hourLines = {
        backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px)",
        backgroundSize: `${100 / hours}% 100%`,
    };
    const nowLeft = now !== null && now >= range.from * 60 && now <= range.to * 60 ? placeSpan({ start: range.from * 60, end: now }, range).width : null;
    const hourAt = (event: React.MouseEvent<HTMLElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        const share = Math.min(0.9999, Math.max(0, (event.clientX - box.left) / box.width));
        return range.from + Math.floor(share * hours);
    };
    const onBar = (event: React.MouseEvent<HTMLElement>) => Boolean((event.target as HTMLElement).closest("[data-shift-card]"));

    const track = (row: Row) => {
        const { lanes, count } = packLanes(row.bars.map((b) => b.span));
        const ghost = hover?.row === row.key ? hover.hour : null;
        return (
            <div
                role="cell"
                className={cn("relative cursor-cell border-b", row.tint ?? "bg-card")}
                style={{ ...hourLines, height: count * LANE + PAD }}
                onMouseMove={(event) => {
                    const hour = onBar(event) ? null : hourAt(event);
                    if (hour === null) setHover(null);
                    else if (hover?.row !== row.key || hover.hour !== hour) setHover({ row: row.key, hour });
                }}
                onMouseLeave={() => setHover(null)}
                onClick={(event) => {
                    if (onBar(event)) return;
                    onAddShift(row.prefill(hourAt(event)));
                }}
            >
                {row.marks.map((mark) => {
                    const place = placeSpan(mark.span, range);
                    if (place.width <= 0) return null;
                    return (
                        <span
                            key={mark.key}
                            title={mark.label}
                            className={cn(
                                "pointer-events-none absolute inset-y-0 flex items-start px-1.5 pt-1 text-[11px] font-semibold text-slate-600",
                                mark.tone === "unavailable" ? styles.unavailable : mark.tone === "off" ? styles.offBand : styles.offBandPending,
                            )}
                            style={{ left: pct(place.left), width: pct(place.width) }}
                        >
                            <span className="truncate">{mark.label}</span>
                        </span>
                    );
                })}
                {ghost !== null ? (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute grid place-items-center rounded-lg border border-dashed border-primary/50 bg-primary/5 text-primary"
                        style={{ left: pct(((ghost - range.from) / hours) * 100), width: pct(100 / hours), top: PAD, height: LANE - PAD }}
                    >
                        <Plus className="size-4" />
                    </span>
                ) : null}
                {nowLeft !== null ? <span aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary/70" style={{ left: pct(nowLeft) }} /> : null}
                {row.bars.map((bar, i) => {
                    const place = placeSpan(bar.span, range);
                    const { shift } = bar;
                    return (
                        <ShiftCard
                            key={bar.key}
                            leadWith="time"
                            time={clockRange(shift.startLocal, shift.endLocal)}
                            overnight={shift.overnight}
                            title={bar.title}
                            detail={bar.detail}
                            site={siteNames?.get(shift.locationId)}
                            hue={roleHue(shift.role)}
                            draft={shift.status === "draft"}
                            removed={bar.removed}
                            edited={bar.edited}
                            conflict={bar.conflict}
                            event={Boolean(shift.eventId)}
                            tooltip={[clockRange(shift.startLocal, shift.endLocal), nameOf(shift), `${shift.filled} of ${shift.capacity} filled`, shift.status === "draft" ? "draft" : null]
                                .filter(Boolean)
                                .join(" · ")}
                            className="absolute overflow-hidden"
                            style={{ left: `calc(${pct(place.left)} + 2px)`, width: `calc(${pct(place.width)} - 4px)`, top: PAD + lanes[i]! * LANE, height: LANE - PAD }}
                            onClick={() => onOpenShift(shift.id)}
                        />
                    );
                })}
            </div>
        );
    };

    const rowCount = sections.reduce((sum, s) => sum + s.rows.length, 0);
    const showSectionHeads = sections.filter((s) => s.id !== null).length > 1;

    return (
        <div
            role="table"
            aria-label={`${longDate(date)}, ${week.location.name}`}
            aria-busy={loading}
            className={cn("grid grid-cols-[220px_minmax(0,1fr)] transition-opacity", loading && "opacity-60")}
            style={{ minWidth: 220 + hours * MIN_HOUR_PX }}
        >
            <div role="row" className="contents">
                <div role="columnheader" className="sticky left-0 top-0 z-30 flex min-h-[56px] flex-col justify-center gap-0.5 border-b border-r bg-card px-3 py-2">
                    {title}
                    <span className="text-[12px] tabular-nums text-muted-foreground">
                        {formatHours(scheduled)} scheduled
                        {open > 0 ? <span className="font-semibold text-amber-700"> · {open} open</span> : null}
                    </span>
                </div>
                <div role="columnheader" className="sticky top-0 z-20 border-b bg-card" style={hourLines}>
                    <div className="relative h-full min-h-[56px]">
                        {Array.from({ length: hours }, (_, i) => (
                            <span
                                key={i}
                                className="absolute bottom-2 pl-1.5 text-[12px] font-medium tabular-nums text-muted-foreground"
                                style={{ left: pct((i / hours) * 100) }}
                            >
                                {compactTime(hourToLocal(range.from + i))}
                            </span>
                        ))}
                        {nowLeft !== null ? (
                            <span aria-hidden className="absolute bottom-0 size-2 -translate-x-[3px] translate-y-1/2 rounded-full bg-primary" style={{ left: pct(nowLeft) }} />
                        ) : null}
                    </div>
                </div>
            </div>

            {sections.map((section) => {
                const isCollapsed = showSectionHeads && section.id !== null && collapsed.has(section.id);
                return (
                    <div key={section.id ?? "top"} role="rowgroup" className="contents">
                        {showSectionHeads && section.id !== null ? (
                            <div role="row" className="col-span-full flex border-b bg-muted">
                                <button
                                    type="button"
                                    aria-expanded={!isCollapsed}
                                    onClick={() => onToggleSection(section.id!)}
                                    className="sticky left-0 inline-flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-foreground/80 hover:text-foreground"
                                >
                                    <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", isCollapsed && "-rotate-90")} />
                                    {section.name}
                                    <span className="font-normal text-muted-foreground">
                                        · {section.count} {section.count === 1 ? "person" : "people"}
                                    </span>
                                </button>
                            </div>
                        ) : null}
                        {isCollapsed
                            ? null
                            : section.rows.map((row) => (
                                  <div key={row.key} role="row" className="group/row contents">
                                      <div role="rowheader" className={cn(labelCell, row.tint)}>
                                          {row.label}
                                          <button
                                              type="button"
                                              aria-label={row.addLabel}
                                              title={row.addLabel}
                                              onClick={() => onAddShift(row.prefill(9))}
                                              className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring group-hover/row:opacity-100"
                                          >
                                              <Plus aria-hidden className="size-4" />
                                          </button>
                                      </div>
                                      {track(row)}
                                  </div>
                              ))}
                    </div>
                );
            })}

            {rowCount <= (groupBy === "people" ? 1 : 0) ? (
                <div role="row" className="col-span-full border-b bg-card px-4 py-6 text-sm text-muted-foreground">
                    {groupBy === "positions" ? (
                        "No positions yet. Add a shift, or give your team their roles in Team."
                    ) : week.people.length === 0 ? (
                        <>
                            Nobody on the team yet.{" "}
                            <Link href={WORKERS_PATH} className="font-medium text-primary underline-offset-2 hover:underline">
                                Add people in Team
                            </Link>
                        </>
                    ) : (
                        "Nobody in this department yet."
                    )}
                </div>
            ) : null}
        </div>
    );
}
