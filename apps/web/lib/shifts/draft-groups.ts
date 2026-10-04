import { parseISO } from "date-fns";
import type { Shift } from "@/lib/types";
import { getLocalParts } from "./shift-time";

/**
 * The drafts of one location in one week: the unit the Scheduler publishes and
 * discards, so it is the unit the Drafts tab shows. A draft is never a loose
 * card; it belongs to the week it will be published with.
 */
export interface DraftGroup {
    key: string;
    locationId?: string;
    locationName: string;
    /** YYYY-MM-DD, the first day of the week at the location (org's week start). */
    weekStart: string;
    shifts: Shift[];
    /** Slots still unfilled across the group. */
    open: number;
    /** When the newest draft in the group was added. */
    latestCreatedAt?: string;
}

/** The first day of the week holding `localDate`, with weeks starting on `weekStartsOn` (0 = Sunday). */
export function weekStartOf(localDate: string, weekStartsOn: number): string {
    const [year, month, day] = localDate.split("-").map(Number) as [number, number, number];
    const date = new Date(Date.UTC(year, month - 1, day));
    const back = (date.getUTCDay() - weekStartsOn + 7) % 7;
    date.setUTCDate(date.getUTCDate() - back);
    return date.toISOString().slice(0, 10);
}

function openSlots(shift: Shift) {
    const total = shift.capacity?.total ?? 0;
    const filled = shift.capacity?.filled ?? shift.assignedWorkers?.length ?? 0;
    return Math.max(total - filled, 0);
}

/** Groups drafts by location and week, soonest week first, each group's shifts in time order. */
export function groupDraftsByWeek(drafts: Shift[], weekStartsOn: number): DraftGroup[] {
    const groups = new Map<string, DraftGroup>();

    for (const shift of drafts) {
        // The week it falls in *there*, not in the viewer's zone or UTC.
        const localDate = getLocalParts(parseISO(shift.startTime), shift.timezone).date;
        const weekStart = weekStartOf(localDate, weekStartsOn);
        const key = `${shift.locationId ?? shift.locationName}|${weekStart}`;

        let group = groups.get(key);
        if (!group) {
            group = {
                key,
                locationId: shift.locationId,
                locationName: shift.locationName,
                weekStart,
                shifts: [],
                open: 0,
            };
            groups.set(key, group);
        }

        group.shifts.push(shift);
        group.open += openSlots(shift);
        if (shift.createdAt && (!group.latestCreatedAt || shift.createdAt > group.latestCreatedAt)) {
            group.latestCreatedAt = shift.createdAt;
        }
    }

    return [...groups.values()]
        .map((group) => ({
            ...group,
            shifts: [...group.shifts].sort((a, b) => a.startTime.localeCompare(b.startTime)),
        }))
        .sort(
            (a, b) =>
                a.weekStart.localeCompare(b.weekStart) || a.locationName.localeCompare(b.locationName),
        );
}
