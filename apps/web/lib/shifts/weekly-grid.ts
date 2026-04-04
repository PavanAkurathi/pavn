import {
    addDays,
    differenceInCalendarDays,
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

export interface WeeklyGridDay {
    date: Date;
    dateKey: string;
    dayLabel: string;
    shortDateLabel: string;
    isToday: boolean;
}

export interface WeeklyGridCell {
    dateKey: string;
    shifts: Shift[];
}

export interface WeeklyGridLane {
    id: string;
    title: string;
    timeLabel: string;
    startMinutes: number;
    cells: WeeklyGridCell[];
}

export interface WeeklyGridSection {
    id: string;
    locationName: string;
    lanes: WeeklyGridLane[];
}

export interface WeeklyGridModel {
    weekStart: Date;
    weekEnd: Date;
    days: WeeklyGridDay[];
    sections: WeeklyGridSection[];
}

type LaneAccumulator = {
    id: string;
    title: string;
    timeLabel: string;
    startMinutes: number;
    cells: Map<string, Shift[]>;
};

type SectionAccumulator = {
    id: string;
    locationName: string;
    lanes: Map<string, LaneAccumulator>;
};

const ALL_LAYOUTS = new Set<ShiftLayout>([
    SHIFT_LAYOUTS.WEEKLY,
    SHIFT_LAYOUTS.LIST,
    SHIFT_LAYOUTS.MONTH,
]);

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

export function getInitialWeekStart(shifts: Shift[], now = new Date()): Date {
    const ordered = [...shifts].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
    const upcoming = ordered.find((shift) => new Date(shift.startTime).getTime() >= startOfDay(now).getTime());
    const anchor = upcoming ? parseISO(upcoming.startTime) : now;

    return startOfWeek(anchor, { weekStartsOn: 0 });
}

export function buildWeeklyGridModel(shifts: Shift[], weekStart: Date): WeeklyGridModel {
    const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(normalizedWeekStart, { weekStartsOn: 0 });
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = addDays(normalizedWeekStart, index);
        return {
            date,
            dateKey: format(date, "yyyy-MM-dd"),
            dayLabel: format(date, "EEE"),
            shortDateLabel: format(date, "MMM d"),
            isToday: isToday(date),
        };
    });

    const sections = new Map<string, SectionAccumulator>();

    for (const shift of shifts) {
        const shiftStart = parseISO(shift.startTime);
        const shiftEnd = parseISO(shift.endTime);
        const dayOffset = differenceInCalendarDays(startOfDay(shiftStart), normalizedWeekStart);
        if (dayOffset < 0 || dayOffset > 6) {
            continue;
        }

        const dayKey = format(shiftStart, "yyyy-MM-dd");
        const locationName = shift.locationName || "Unassigned location";
        const locationKey = shift.locationId || locationName;
        const laneStart = shiftStart.getHours() * 60 + shiftStart.getMinutes();
        const laneEnd = shiftEnd.getHours() * 60 + shiftEnd.getMinutes();
        const laneKey = `${shift.title}|${laneStart}|${laneEnd}`;

        let section = sections.get(locationKey);
        if (!section) {
            section = {
                id: locationKey,
                locationName,
                lanes: new Map(),
            };
            sections.set(locationKey, section);
        }

        let lane = section.lanes.get(laneKey);
        if (!lane) {
            lane = {
                id: `${locationKey}:${laneKey}`,
                title: shift.title,
                timeLabel: `${format(shiftStart, "h:mm a")} - ${format(shiftEnd, "h:mm a")}`,
                startMinutes: laneStart,
                cells: new Map(),
            };
            section.lanes.set(laneKey, lane);
        }

        const dayShifts = lane.cells.get(dayKey) || [];
        dayShifts.push(shift);
        dayShifts.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        lane.cells.set(dayKey, dayShifts);
    }

    return {
        weekStart: normalizedWeekStart,
        weekEnd,
        days,
        sections: Array.from(sections.values())
            .sort((a, b) => a.locationName.localeCompare(b.locationName))
            .map((section) => ({
                id: section.id,
                locationName: section.locationName,
                lanes: Array.from(section.lanes.values())
                    .sort((a, b) => {
                        if (a.startMinutes !== b.startMinutes) {
                            return a.startMinutes - b.startMinutes;
                        }

                        return a.title.localeCompare(b.title);
                    })
                    .map((lane) => ({
                        id: lane.id,
                        title: lane.title,
                        timeLabel: lane.timeLabel,
                        startMinutes: lane.startMinutes,
                        cells: days.map((day) => ({
                            dateKey: day.dateKey,
                            shifts: lane.cells.get(day.dateKey) || [],
                        })),
                    })),
            })),
    };
}
