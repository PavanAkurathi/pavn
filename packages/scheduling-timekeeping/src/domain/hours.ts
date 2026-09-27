// packages/scheduling-timekeeping/src/domain/hours.ts

import { calculateDailyOvertimeMinutes } from "@repo/config";

/**
 * Scheduled hours only. Pay is deliberately absent: the scheduler shows how
 * long people work and when that tips into overtime; what it costs belongs to
 * payroll.
 */

export type OvertimePolicy = "weekly_40" | "daily_8";

export const WEEKLY_OVERTIME_THRESHOLD_MINUTES = 40 * 60;

export interface WorkInterval {
    start: Date;
    end: Date;
    /** Unpaid break taken inside the interval. */
    breakMinutes: number;
    /** Local date the work starts on at its location; groups work for daily rules. */
    localDate: string;
}

export function paidMinutes(interval: Pick<WorkInterval, "start" | "end" | "breakMinutes">): number {
    const worked = Math.round((interval.end.getTime() - interval.start.getTime()) / 60_000);
    return Math.max(0, worked - Math.max(0, interval.breakMinutes));
}

export interface WeekHours {
    scheduledMinutes: number;
    overtimeMinutes: number;
}

/**
 * Total paid minutes for one person's week, and how many of them are overtime.
 *
 * - `weekly_40`: everything past 40 hours in the week.
 * - `daily_8`: everything past 8 hours in any one local day, the same rule the
 *   timesheet export applies (see `calculateDailyOvertimeMinutes`).
 *
 * Callers pass every interval the person works that week, at every location,
 * because overtime does not care which store the hours were at.
 */
export function summarizeWeek(intervals: WorkInterval[], policy: OvertimePolicy): WeekHours {
    let scheduledMinutes = 0;
    const byDay = new Map<string, number>();

    for (const interval of intervals) {
        const minutes = paidMinutes(interval);
        scheduledMinutes += minutes;
        byDay.set(interval.localDate, (byDay.get(interval.localDate) ?? 0) + minutes);
    }

    let overtimeMinutes = 0;
    if (policy === "daily_8") {
        for (const minutes of byDay.values()) {
            overtimeMinutes += calculateDailyOvertimeMinutes(minutes, "daily_8");
        }
    } else {
        overtimeMinutes = Math.max(0, scheduledMinutes - WEEKLY_OVERTIME_THRESHOLD_MINUTES);
    }

    return { scheduledMinutes, overtimeMinutes };
}

/** How much more overtime `extra` would add on top of what the person already has. */
export function addedOvertimeMinutes(
    existing: WorkInterval[],
    extra: WorkInterval,
    policy: OvertimePolicy,
): number {
    const before = summarizeWeek(existing, policy).overtimeMinutes;
    const after = summarizeWeek([...existing, extra], policy).overtimeMinutes;
    return Math.max(0, after - before);
}
