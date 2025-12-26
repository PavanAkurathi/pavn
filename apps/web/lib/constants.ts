export const SHIFT_STATUS = {
    ALL: 'all',
    OPEN: 'open',
    ASSIGNED: 'assigned',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    APPROVED: 'approved',
} as const;

export const VIEW_MODES = {
    LIST: 'list' as const,
    CALENDAR: 'calendar' as const,
};

export const LOCATIONS = {
    ALL: 'all',
};

export const STATUS_LABELS: Record<string, string> = {
    [SHIFT_STATUS.ALL]: 'All Status',
    [SHIFT_STATUS.OPEN]: 'Open',
    [SHIFT_STATUS.ASSIGNED]: 'Assigned',
    [SHIFT_STATUS.COMPLETED]: 'Completed',
    [SHIFT_STATUS.CANCELLED]: 'Cancelled',
    [SHIFT_STATUS.APPROVED]: 'Approved',
};
