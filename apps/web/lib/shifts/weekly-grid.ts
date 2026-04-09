import {
    addDays,
    endOfWeek,
    format,
    isToday,
    parseISO,
    startOfDay,
    startOfWeek,
} from "date-fns";

import type { Shift, ShiftLayout } from "@/lib/types";
import { SHIFT_LAYOUTS } from "@/lib/constants";

export type ShiftDashboardTab = "upcoming" | "past";

export interface WeeklyGridTimeSlot {
    hour: number;
    label: string;
}

export interface WeeklyGridEvent {
    id: string;
    shift: Shift;
    dateKey: string;
    locationName: string;
    startMinutes: number;
    endMinutes: number;
    durationMinutes: number;
    column: number;
    columnCount: number;
    timeLabel: string;
}

export interface WeeklyGridDay {
    date: Date;
    dateKey: string;
    dayLabel: string;
    shortDateLabel: string;
    isToday: boolean;
    events: WeeklyGridEvent[];
}

export interface WeeklyGridModel {
    weekStart: Date;
    weekEnd: Date;
    days: WeeklyGridDay[];
    timeSlots: WeeklyGridTimeSlot[];
    startHour: number;
    endHour: number;
    totalMinutes: number;
    hasShifts: boolean;
}

type RawWeeklyGridEvent = Omit<WeeklyGridEvent, "column" | "columnCount">;

const ALL_LAYOUTS = new Set<ShiftLayout>([
    SHIFT_LAYOUTS.WEEKLY,
    SHIFT_LAYOUTS.LIST,
    SHIFT_LAYOUTS.MONTH,
]);

const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;

export function getAvailableShiftLayouts(tab: ShiftDashboardTab): ShiftLayout[] {
    if (tab === "past") {
        return [SHIFT_LAYOUTS.LIST, SHIFT_LAYOUTS.MONTH];
    }

    return [SHIFT_LAYOUTS.WEEKLY, SHIFT_LAYOUTS.LIST, SHIFT_LAYOUTS.MONTH];
}

export function resolveShiftLayout(tab: ShiftDashboardTab, layout: string | null | undefined): ShiftLayout {
    if (tab === "past") {
        return layout === SHIFT_LAYOUTS.MONTH ? SHIFT_LAYOUTS.MONTH : SHIFT_LAYOUTS.LIST;
    }

    if (layout && ALL_LAYOUTS.has(layout as ShiftLayout)) {
        return layout as ShiftLayout;
    }

    return SHIFT_LAYOUTS.WEEKLY;
}

export function getInitialWeekStart(_shifts: Shift[], now = new Date()): Date {
    return startOfWeek(now, { weekStartsOn: 0 });
}

export function hasShiftsInWeek(shifts: Shift[], weekStart: Date) {
    const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 0 });
    const weekEndExclusive = addDays(normalizedWeekStart, 7);

    return shifts.some((shift) => {
        const shiftStart = parseISO(shift.startTime);
        const shiftEnd = parseISO(shift.endTime);
        return shiftEnd.getTime() > normalizedWeekStart.getTime() && shiftStart.getTime() < weekEndExclusive.getTime();
    });
}

function minutesFromDayStart(date: Date, dayStart: Date) {
    return Math.max(0, Math.round((date.getTime() - dayStart.getTime()) / 60000));
}

function roundDownToHour(minutes: number) {
    return Math.floor(minutes / 60) * 60;
}

function roundUpToHour(minutes: number) {
    return Math.ceil(minutes / 60) * 60;
}

function formatTimeSlot(hour: number) {
    const normalizedHour = hour % 24;
    const period = normalizedHour >= 12 ? "PM" : "AM";
    const displayHour = normalizedHour % 12 || 12;
    return `${displayHour} ${period}`;
}

function buildRawEventsForDay(
    shifts: Shift[],
    weekStart: Date,
): Map<string, RawWeeklyGridEvent[]> {
    const eventsByDay = new Map<string, RawWeeklyGridEvent[]>();
    const weekEndExclusive = addDays(weekStart, 7);

    for (const shift of shifts) {
        const shiftStart = parseISO(shift.startTime);
        const shiftEnd = parseISO(shift.endTime);

        if (shiftEnd.getTime() <= weekStart.getTime() || shiftStart.getTime() >= weekEndExclusive.getTime()) {
            continue;
        }

        let currentDay = startOfDay(
            new Date(Math.max(shiftStart.getTime(), weekStart.getTime())),
        );

        while (currentDay.getTime() < weekEndExclusive.getTime() && currentDay.getTime() < shiftEnd.getTime()) {
            const nextDay = addDays(currentDay, 1);
            const segmentStart = new Date(Math.max(shiftStart.getTime(), currentDay.getTime()));
            const segmentEnd = new Date(
                Math.min(shiftEnd.getTime(), nextDay.getTime(), weekEndExclusive.getTime()),
            );

            if (segmentEnd.getTime() > segmentStart.getTime()) {
                const dayKey = format(currentDay, "yyyy-MM-dd");
                const dayEvents = eventsByDay.get(dayKey) || [];
                const startMinutes = minutesFromDayStart(segmentStart, currentDay);
                const endMinutes = minutesFromDayStart(segmentEnd, currentDay);

                dayEvents.push({
                    id: `${shift.id}:${dayKey}:${startMinutes}`,
                    shift,
                    dateKey: dayKey,
                    locationName: shift.locationName || "Unassigned location",
                    startMinutes,
                    endMinutes,
                    durationMinutes: Math.max(endMinutes - startMinutes, 15),
                    timeLabel: `${format(segmentStart, "h:mm a")} - ${format(segmentEnd, "h:mm a")}`,
                });
                eventsByDay.set(dayKey, dayEvents);
            }

            currentDay = nextDay;
        }
    }

    return eventsByDay;
}

function layoutDayEvents(events: RawWeeklyGridEvent[]): WeeklyGridEvent[] {
    const sorted = [...events].sort((a, b) => {
        if (a.startMinutes !== b.startMinutes) {
            return a.startMinutes - b.startMinutes;
        }

        if (a.endMinutes !== b.endMinutes) {
            return a.endMinutes - b.endMinutes;
        }

        return a.shift.title.localeCompare(b.shift.title);
    });

    const result: WeeklyGridEvent[] = [];
    let currentGroup: RawWeeklyGridEvent[] = [];
    let currentGroupEnd = -1;

    const finalizeGroup = () => {
        if (currentGroup.length === 0) {
            return;
        }

        const columns: number[] = [];
        const laidOutGroup = currentGroup.map((event) => {
            let columnIndex = columns.findIndex((columnEnd) => columnEnd <= event.startMinutes);
            if (columnIndex === -1) {
                columnIndex = columns.length;
                columns.push(event.endMinutes);
            } else {
                columns[columnIndex] = event.endMinutes;
            }

            return {
                ...event,
                column: columnIndex,
                columnCount: 0,
            };
        });

        const columnCount = columns.length;
        result.push(
            ...laidOutGroup.map((event) => ({
                ...event,
                columnCount,
            })),
        );

        currentGroup = [];
        currentGroupEnd = -1;
    };

    for (const event of sorted) {
        if (!currentGroup.length) {
            currentGroup = [event];
            currentGroupEnd = event.endMinutes;
            continue;
        }

        if (event.startMinutes < currentGroupEnd) {
            currentGroup.push(event);
            currentGroupEnd = Math.max(currentGroupEnd, event.endMinutes);
            continue;
        }

        finalizeGroup();
        currentGroup = [event];
        currentGroupEnd = event.endMinutes;
    }

    finalizeGroup();
    return result;
}

export function buildWeeklyGridModel(shifts: Shift[], weekStart: Date): WeeklyGridModel {
    const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 0 });
    const weekEndExclusive = addDays(normalizedWeekStart, 7);
    const weekEnd = endOfWeek(normalizedWeekStart, { weekStartsOn: 0 });
    const rawEventsByDay = buildRawEventsForDay(shifts, normalizedWeekStart);
    const allRawEvents = Array.from(rawEventsByDay.values()).flat();

    const earliestMinutes = allRawEvents.length
        ? Math.min(...allRawEvents.map((event) => event.startMinutes))
        : DEFAULT_START_HOUR * 60;
    const latestMinutes = allRawEvents.length
        ? Math.max(...allRawEvents.map((event) => event.endMinutes))
        : DEFAULT_END_HOUR * 60;

    const startHour = Math.max(
        0,
        Math.min(DEFAULT_START_HOUR, roundDownToHour(earliestMinutes) / 60),
    );
    const endHour = Math.min(
        24,
        Math.max(DEFAULT_END_HOUR, roundUpToHour(latestMinutes) / 60),
    );
    const safeEndHour = endHour <= startHour ? startHour + 1 : endHour;
    const timeSlots = Array.from({ length: safeEndHour - startHour }, (_, index) => ({
        hour: startHour + index,
        label: formatTimeSlot(startHour + index),
    }));

    const days = Array.from({ length: 7 }, (_, index) => {
        const date = addDays(normalizedWeekStart, index);
        const dateKey = format(date, "yyyy-MM-dd");
        return {
            date,
            dateKey,
            dayLabel: format(date, "EEE"),
            shortDateLabel: format(date, "MMM d"),
            isToday: isToday(date),
            events: layoutDayEvents(rawEventsByDay.get(dateKey) || []),
        };
    });

    return {
        weekStart: normalizedWeekStart,
        weekEnd: new Date(Math.min(weekEnd.getTime(), weekEndExclusive.getTime() - 1)),
        days,
        timeSlots,
        startHour,
        endHour: safeEndHour,
        totalMinutes: (safeEndHour - startHour) * 60,
        hasShifts: allRawEvents.length > 0,
    };
}
