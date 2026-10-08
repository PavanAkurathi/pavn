"use client";

import { Plus } from "lucide-react";
import type { SchedulerShift } from "@repo/contracts/scheduler";
import { cn } from "@repo/ui/lib/utils";
import { compactRange, dayOfMonth, longDate, sameMonth, weekdayShort } from "@/lib/scheduler/format";

/** Shifts shown in a day before it ends in "+N more". */
const SHOWN_PER_DAY = 3;

/**
 * The month at a glance: one cell per day, each with its shifts as short lines
 * ("9a–5p Server 1/2"), amber while spots are open, dashed while still a draft.
 * A shift opens the same editor as the list; a day's number opens that day in
 * the list; the + adds a shift on that day. Hours and open spots, never money.
 */
export function MonthCalendar({
    days,
    month,
    today,
    shifts,
    eventNames,
    loading,
    onOpenShift,
    onAddShift,
    onOpenDay,
}: {
    /** Whole weeks covering the month, as local dates. */
    days: string[];
    /** Any local date in the month on show. */
    month: string;
    today: string;
    shifts: SchedulerShift[];
    eventNames: Map<string, string>;
    loading: boolean;
    onOpenShift: (shift: SchedulerShift) => void;
    onAddShift: (localDate: string) => void;
    onOpenDay: (localDate: string) => void;
}) {
    const byDay = new Map<string, SchedulerShift[]>();
    for (const shift of shifts) {
        if (shift.pendingRemoval) continue;
        const list = byDay.get(shift.localDate) ?? [];
        list.push(shift);
        byDay.set(shift.localDate, list);
    }
    for (const list of byDay.values()) list.sort((a, b) => a.startLocal.localeCompare(b.startLocal) || a.role.localeCompare(b.role));

    return (
        <div aria-busy={loading} className={cn("overflow-hidden rounded-2xl border bg-card transition-opacity", loading && "opacity-60")}>
            <div className="grid grid-cols-7 border-b bg-muted/30">
                {days.slice(0, 7).map((day) => (
                    <div key={day} className="py-2.5 text-center text-[13px] font-semibold text-muted-foreground">
                        {weekdayShort(day)}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {days.map((day, index) => {
                    const inMonth = sameMonth(day, month);
                    const list = byDay.get(day) ?? [];
                    const isToday = day === today;
                    const openSpots = list.reduce((sum, shift) => sum + shift.open, 0);
                    return (
                        <div
                            key={day}
                            className={cn(
                                "group relative flex min-h-[7.5rem] flex-col gap-1 border-b border-r p-1.5",
                                index % 7 === 6 && "border-r-0",
                                index >= days.length - 7 && "border-b-0",
                                !inMonth && "bg-muted/40",
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => onOpenDay(day)}
                                    title={`Open ${longDate(day)} in the list`}
                                    className={cn(
                                        "grid size-7 place-items-center rounded-full text-[13px] font-semibold tabular-nums hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                                        isToday ? "bg-primary text-primary-foreground hover:bg-primary" : inMonth ? "text-foreground" : "text-muted-foreground",
                                    )}
                                >
                                    {dayOfMonth(day)}
                                </button>
                                {openSpots > 0 ? (
                                    <span className="mr-auto ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">{openSpots} open</span>
                                ) : null}
                                <button
                                    type="button"
                                    aria-label={`Add a shift on ${longDate(day)}`}
                                    onClick={() => onAddShift(day)}
                                    className="grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                                >
                                    <Plus aria-hidden className="size-3.5" />
                                </button>
                            </div>
                            {list.slice(0, SHOWN_PER_DAY).map((shift) => {
                                const name = (shift.eventId && eventNames.get(shift.eventId)) || shift.role;
                                const open = shift.open > 0;
                                const draft = shift.status === "draft";
                                return (
                                    <button
                                        key={shift.id}
                                        type="button"
                                        onClick={() => onOpenShift(shift)}
                                        title={`${name} · ${compactRange(shift.startLocal, shift.endLocal)} · ${shift.filled} of ${shift.capacity} filled${draft ? " · draft" : ""}`}
                                        className={cn(
                                            "flex w-full min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[12px] leading-tight transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring",
                                            draft ? "border-dashed bg-card" : "bg-muted/30",
                                            open ? "border-l-[3px] border-l-amber-500" : "border-l-[3px] border-l-emerald-500",
                                        )}
                                    >
                                        <span className="min-w-0 flex-1 truncate">
                                            <span className="font-semibold tabular-nums">{compactRange(shift.startLocal, shift.endLocal)}</span> {name}
                                        </span>
                                        <span className={cn("shrink-0 tabular-nums", open ? "font-semibold text-amber-700" : "text-muted-foreground")}>
                                            {shift.filled}/{shift.capacity}
                                        </span>
                                    </button>
                                );
                            })}
                            {list.length > SHOWN_PER_DAY ? (
                                <button type="button" onClick={() => onOpenDay(day)} className="px-1.5 text-left text-[12px] font-semibold text-primary hover:underline">
                                    +{list.length - SHOWN_PER_DAY} more
                                </button>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
