"use client";

import { useRef } from "react";
import type { SchedulerWeek } from "@repo/contracts/scheduler";
import { cn } from "@repo/ui/lib/utils";
import { coverageText, type DayCoverage } from "@/lib/scheduler/day-model";
import { dayOfMonth, weekdayLong, weekdayShort } from "@/lib/scheduler/format";
import { CoverageBadge } from "./coverage-badge";

/**
 * The seven days as big tiles, each saying in words how covered it is. Pick one
 * and the list below shows that day. It is a tablist, so arrow keys, Home and
 * End move between days.
 */
export function WeekStrip({
    week,
    coverage,
    selected,
    onSelect,
}: {
    week: SchedulerWeek;
    coverage: DayCoverage[];
    selected: number;
    onSelect: (dayIndex: number) => void;
}) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);

    const onKeyDown = (event: React.KeyboardEvent) => {
        const last = week.days.length - 1;
        const next =
            event.key === "ArrowRight" ? Math.min(last, selected + 1)
            : event.key === "ArrowLeft" ? Math.max(0, selected - 1)
            : event.key === "Home" ? 0
            : event.key === "End" ? last
            : null;
        if (next === null) return;
        event.preventDefault();
        onSelect(next);
        refs.current[next]?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label="Days of the week"
            data-testid="week-strip"
            onKeyDown={onKeyDown}
            className="grid grid-cols-7 gap-1.5 sm:gap-2"
        >
            {week.days.map((day, index) => {
                const c = coverage[index]!;
                const isSelected = index === selected;
                return (
                    <button
                        key={day.localDate}
                        ref={(el) => {
                            refs.current[index] = el;
                        }}
                        type="button"
                        role="tab"
                        id={`day-tab-${index}`}
                        aria-selected={isSelected}
                        aria-controls="day-panel"
                        tabIndex={isSelected ? 0 : -1}
                        data-testid={`day-tile-${index}`}
                        data-coverage={c.status}
                        aria-label={`${weekdayLong(day.localDate)} ${dayOfMonth(day.localDate)}${day.isToday ? ", today" : ""}: ${coverageText(c).long}${c.events ? `, ${c.events} ${c.events === 1 ? "event" : "events"}` : ""}`}
                        onClick={() => onSelect(index)}
                        className={cn(
                            "flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border px-1 pb-2 pt-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:gap-2 sm:pb-2.5",
                            isSelected
                                ? "border-secondary bg-secondary text-secondary-foreground shadow-card"
                                : "bg-card hover:bg-muted",
                        )}
                    >
                        <span
                            className={cn(
                                "flex items-center gap-1 text-xs font-medium uppercase tracking-wide",
                                isSelected ? "text-secondary-foreground/80" : "text-muted-foreground",
                            )}
                        >
                            {weekdayShort(day.localDate)}
                            {c.events > 0 ? <span aria-hidden>◆</span> : null}
                        </span>
                        <span
                            className={cn(
                                "grid size-9 place-items-center rounded-full text-lg font-semibold tabular-nums sm:size-10",
                                day.isToday && "bg-primary text-primary-foreground",
                            )}
                        >
                            {dayOfMonth(day.localDate)}
                        </span>
                        <CoverageBadge coverage={c} />
                    </button>
                );
            })}
        </div>
    );
}
