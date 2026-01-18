export type ShiftStatus = 'published' | 'assigned' | 'in-progress' | 'completed' | 'approved' | 'cancelled';

export const VALID_TRANSITIONS: Record<ShiftStatus, ShiftStatus[]> = {
    'published': ['assigned', 'cancelled'],
    'assigned': ['published', 'in-progress', 'cancelled'], // Can go back to published if unassigned
    'in-progress': ['completed', 'cancelled'], // Can be cancelled mid-shift
    'completed': ['approved', 'in-progress'], // 'in-progress' allowed for reopening/correction
    'approved': ['completed'], // Can be un-approved
    'cancelled': ['published'], // Can be re-published (maybe?)
};

export function validateShiftTransition(currentStatus: string, nextStatus: string): void {
    const validNextStatuses = VALID_TRANSITIONS[currentStatus as ShiftStatus];

    if (!validNextStatuses || !validNextStatuses.includes(nextStatus as ShiftStatus)) {
        throw new Error(`Invalid shift status transition: ${currentStatus} -> ${nextStatus}`);
    }
}
