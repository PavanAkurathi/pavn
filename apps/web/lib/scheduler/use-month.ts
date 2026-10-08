"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { SchedulerShift, SchedulerWeek } from "@repo/contracts/scheduler";
import { fetchSchedulerWeek, weekKey } from "./client";
import { addDays, monthGrid } from "./format";

/** SWR key prefix for a month calendar's data, so edits elsewhere can refresh it. */
export const MONTH_KEY = "scheduler-month";

type MonthKey = readonly [typeof MONTH_KEY, string, string, number];

/** Every week the calendar shows, for each site in view: the same week endpoint the rest of the Scheduler reads. */
function fetchMonth([, siteIds, firstDay, weeks]: MonthKey): Promise<SchedulerWeek[]> {
    const ids = siteIds.split(",").filter(Boolean);
    const starts = Array.from({ length: weeks }, (_, i) => addDays(firstDay, i * 7));
    return Promise.all(ids.flatMap((id) => starts.map((start) => fetchSchedulerWeek(weekKey(id, start)))));
}

/** The shifts a month calendar shows, loaded only while the calendar is on screen. */
export function useMonthShifts({ siteIds, date, weekStartsOn, enabled }: { siteIds: string[]; date: string; weekStartsOn: number; enabled: boolean }) {
    const days = useMemo(() => monthGrid(date, weekStartsOn), [date, weekStartsOn]);
    const key: MonthKey | null = enabled && siteIds.length ? [MONTH_KEY, siteIds.join(","), days[0]!, days.length / 7] : null;
    const { data, error, isLoading } = useSWR(key, fetchMonth, { keepPreviousData: true, revalidateOnFocus: true });

    const { shifts, eventNames } = useMemo(() => {
        const weeks = data ?? [];
        const byId = new Map<string, SchedulerShift>();
        for (const week of weeks) for (const shift of week.shifts) byId.set(shift.id, shift);
        return {
            shifts: [...byId.values()],
            eventNames: new Map(weeks.flatMap((week) => week.events.map((event) => [event.id, event.name] as const))),
        };
    }, [data]);

    return { days, shifts, eventNames, error: error as Error | undefined, loading: isLoading };
}
