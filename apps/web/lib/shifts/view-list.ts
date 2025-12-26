import { format, isToday, isTomorrow, isThisWeek, parseISO, addHours } from 'date-fns';
import { Shift } from '../types';

export function filterActiveShifts(shifts: Shift[]): Shift[] {
    const now = new Date();
    // Active includes Open shifts
    // OR Assigned shifts that have NOT yet passed the "2 hours post-shift" threshold
    // (If they are just assigned but ended 10 mins ago, they technically might still be "active" or "pending clock out"
    // but for this logic, let's say they stay in Upcoming/Active until they hit that 2-hour mark or are marked completed)
    return shifts.filter(shift => {
        if (shift.status === 'open') return true;
        if (shift.status === 'assigned') {
            const twoHoursAfterEnd = addHours(parseISO(shift.endTime), 2);
            return now < twoHoursAfterEnd;
        }
        return false;
    });
}

export function filterNeedsApprovalShifts(shifts: Shift[]): Shift[] {
    const now = new Date();
    return shifts.filter(shift => {
        // 1. Explicitly Completed (Clocked out / Marked done)
        if (shift.status === 'completed') return true;

        // 2. Implied Completed (Assigned + >2 hours past end time)
        if (shift.status === 'assigned') {
            const twoHoursAfterEnd = addHours(parseISO(shift.endTime), 2);
            return now >= twoHoursAfterEnd;
        }

        return false;
    });
}

export function filterHistoryShifts(shifts: Shift[]): Shift[] {
    return shifts.filter(shift => shift.status === 'approved' || shift.status === 'cancelled');
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

export function filterUpcomingDates(dates: string[]): string[] {
    const today = new Date().toISOString().split('T')[0] ?? '';
    return dates.filter(date => date >= today);
}

export function filterPastDates(dates: string[]): string[] {
    const today = new Date().toISOString().split('T')[0] ?? '';
    return dates.filter(date => date < today);
}

export function formatShiftDateLabel(dateStr: string): string {
    const date = parseISO(dateStr);
    return format(date, 'EEEE, MMMM d, yyyy'); // e.g. "Tuesday, October 25, 2022"
}
