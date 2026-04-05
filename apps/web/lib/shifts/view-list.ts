import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';
import { Shift } from '../types';

function isPastShift(shift: Shift, now = new Date()) {
    return parseISO(shift.endTime).getTime() <= now.getTime();
}

function isActiveShiftStatus(status: Shift["status"]) {
    return status === 'published' || status === 'open' || status === 'assigned' || status === 'in-progress';
}

function hasRosteredWorkers(shift: Shift) {
    return (shift.assignedWorkers?.length ?? 0) > 0 || (shift.capacity?.filled ?? 0) > 0;
}

export function filterActiveShifts(shifts: Shift[]): Shift[] {
    const now = new Date();

    return shifts.filter((shift) => isActiveShiftStatus(shift.status) && !isPastShift(shift, now));
}

export function filterNeedsApprovalShifts(shifts: Shift[]): Shift[] {
    const now = new Date();

    return shifts.filter((shift) => {
        if (!isPastShift(shift, now) || !hasRosteredWorkers(shift)) {
            return false;
        }

        if (shift.status === 'approved' || shift.status === 'cancelled') {
            return false;
        }

        return shift.status === 'completed' || isActiveShiftStatus(shift.status);
    });
}

export function filterHistoryShifts(shifts: Shift[]): Shift[] {
    const now = new Date();
    const pendingIds = new Set(filterNeedsApprovalShifts(shifts).map((shift) => shift.id));

    return shifts.filter((shift) => {
        if (!isPastShift(shift, now) || pendingIds.has(shift.id)) {
            return false;
        }

        return shift.status === 'approved' || shift.status === 'cancelled' || shift.status === 'completed' || isActiveShiftStatus(shift.status);
    });
}
export function groupShiftsByDate(shifts: Shift[]): Record<string, Shift[]> {
    const grouped: Record<string, Shift[]> = {};

    shifts.forEach(shift => {
        // Assuming startTime is ISO string
        const dateKey = shift.startTime.split('T')[0] ?? '';
        if (!grouped[dateKey]) {
            grouped[dateKey] = [];
        }
        grouped[dateKey].push(shift);
    });

    return grouped;
}




export function formatShiftDateLabel(dateStr: string): string {
    const date = parseISO(dateStr);
    return format(date, 'EEEE, MMMM d, yyyy'); // e.g. "Tuesday, October 25, 2022"
}

/**
 * Groups shifts that are at the same time and location.
 * Returns an array of arrays, where each inner array represents a "card" (single or grouped).
 */
export function groupConcurrentShifts(shifts: Shift[]): Shift[][] {
    const groups: Record<string, Shift[]> = {};
    const result: Shift[][] = [];

    shifts.forEach(shift => {
        // Key: startTime + endTime + locationName (or ID if available)
        // Using common attributes that define a "Event"
        const key = `${shift.startTime}-${shift.endTime}-${shift.locationName}`;

        if (!groups[key]) {
            groups[key] = [];
            // We maintain order by pushing to result array immediately
            // But we store reference in map to push subsequent items
            result.push(groups[key]);
        }
        groups[key].push(shift);
    });

    return result;
}
