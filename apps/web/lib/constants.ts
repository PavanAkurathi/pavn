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

// Centralized API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SHIFTS_API_URL || "http://localhost:4005";
