import { Shift } from '../types';

export function indexShiftsByDate(shifts: Shift[]): Map<string, Shift[]> {
    const map = new Map<string, Shift[]>();

    shifts.forEach(shift => {
        const dateKey = shift.startTime.split('T')[0] ?? '';
        const existing = map.get(dateKey) || [];
        existing.push(shift);
        map.set(dateKey, existing);
    });

    return map;
}
