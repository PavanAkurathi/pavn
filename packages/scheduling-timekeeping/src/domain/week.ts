// packages/scheduling-timekeeping/src/domain/week.ts

import { addDaysToLocalDate, combineDateTimeTz, localDateInZone, localTimeInZone } from "../utils/zoned-time";

/**
 * A scheduling week is seven local calendar days at one location, starting on
 * the organization's chosen weekday. Everything here works on local date
 * strings ("YYYY-MM-DD") and only turns them into instants at the edges, so a
 * week that crosses a daylight-saving change still starts at local midnight.
 */

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: string): boolean {
    if (!LOCAL_DATE.test(value)) return false;
    const [y, m, d] = value.split("-").map(Number);
    const probe = new Date(Date.UTC(y!, m! - 1, d!));
    return probe.getUTCFullYear() === y && probe.getUTCMonth() === m! - 1 && probe.getUTCDate() === d;
}

/** 0 = Sunday … 6 = Saturday, for a local calendar date. */
export function dayOfWeek(localDate: string): number {
    const [y, m, d] = localDate.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function diffLocalDays(from: string, to: string): number {
    const [y1, m1, d1] = from.split("-").map(Number);
    const [y2, m2, d2] = to.split("-").map(Number);
    return Math.round((Date.UTC(y2!, m2! - 1, d2!) - Date.UTC(y1!, m1! - 1, d1!)) / 86_400_000);
}

/** The first day of the week that contains `localDate`. */
export function startOfLocalWeek(localDate: string, weekStartsOn: number): string {
    const back = (dayOfWeek(localDate) - weekStartsOn + 7) % 7;
    return addDaysToLocalDate(localDate, -back);
}

/** The seven local dates of the week starting at `weekStart`. */
export function weekDates(weekStart: string): string[] {
    return Array.from({ length: 7 }, (_, i) => addDaysToLocalDate(weekStart, i));
}

/** Local midnight at the start of the week up to local midnight after its last day. */
export function weekBounds(weekStart: string, timeZone: string): { start: Date; end: Date } {
    return {
        start: combineDateTimeTz(weekStart, "00:00", timeZone),
        end: combineDateTimeTz(addDaysToLocalDate(weekStart, 7), "00:00", timeZone),
    };
}

/** Which day of the week an instant falls on, locally. Outside 0–6 means another week. */
export function dayIndexOf(instant: Date, weekStart: string, timeZone: string): number {
    return diffLocalDays(weekStart, localDateInZone(instant, timeZone));
}

export interface LocalDaySpan {
    dayIndex: number;
    startLocal: string;
    /** "24:00" when the span runs to midnight. */
    endLocal: string;
    wholeDay: boolean;
}

/**
 * Cut a stretch of time into one span per local day it touches inside the week,
 * e.g. time off from Friday 17:00 to Sunday 12:00. Days outside the week are
 * dropped.
 */
export function splitIntoDaySpans(start: Date, end: Date, weekStart: string, timeZone: string): LocalDaySpan[] {
    const spans: LocalDaySpan[] = [];
    if (end.getTime() <= start.getTime()) return spans;

    const firstDay = dayIndexOf(start, weekStart, timeZone);
    // The last instant inside the stretch decides the last day it touches.
    const lastDay = dayIndexOf(new Date(end.getTime() - 1), weekStart, timeZone);

    for (let day = Math.max(firstDay, 0); day <= Math.min(lastDay, 6); day++) {
        const dayDate = addDaysToLocalDate(weekStart, day);
        const dayStart = combineDateTimeTz(dayDate, "00:00", timeZone);
        const dayEnd = combineDateTimeTz(addDaysToLocalDate(dayDate, 1), "00:00", timeZone);
        const from = start.getTime() > dayStart.getTime() ? start : dayStart;
        const to = end.getTime() < dayEnd.getTime() ? end : dayEnd;
        const reachesMidnight = to.getTime() === dayEnd.getTime();
        spans.push({
            dayIndex: day,
            startLocal: localTimeInZone(from, timeZone),
            endLocal: reachesMidnight ? "24:00" : localTimeInZone(to, timeZone),
            wholeDay: from.getTime() === dayStart.getTime() && reachesMidnight,
        });
    }

    return spans;
}
