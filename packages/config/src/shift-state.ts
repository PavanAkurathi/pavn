export type ShiftStatus = 'draft' | 'published' | 'assigned' | 'in-progress' | 'completed' | 'approved' | 'cancelled';

export const VALID_TRANSITIONS: Record<ShiftStatus, ShiftStatus[]> = {
    'draft': ['published', 'cancelled'],
    'published': ['assigned', 'cancelled'],
    'assigned': ['published', 'in-progress', 'cancelled', 'approved'], // Can go back to published if unassigned
    'in-progress': ['completed', 'cancelled', 'approved'], // Can be cancelled mid-shift
    'completed': ['approved', 'in-progress'], // 'in-progress' allowed for reopening/correction
    'approved': ['completed'], // Can be un-approved for corrections
    'cancelled': ['draft', 'published'], // Can be re-drafted or re-published
};

export function validateShiftTransition(currentStatus: string, nextStatus: string): void {
    const validNextStatuses = VALID_TRANSITIONS[currentStatus as ShiftStatus];

    if (!validNextStatuses || !validNextStatuses.includes(nextStatus as ShiftStatus)) {
        throw new Error(`Invalid shift status transition: ${currentStatus} -> ${nextStatus}`);
    }
}
