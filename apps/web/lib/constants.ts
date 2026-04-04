export const SHIFT_STATUS = {
    ALL: 'all',
    PUBLISHED: 'published',
    OPEN: 'open',
    ASSIGNED: 'assigned',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    APPROVED: 'approved',
} as const;

export const SHIFT_LAYOUTS = {
    WEEKLY: 'weekly' as const,
    LIST: 'list' as const,
    MONTH: 'month' as const,
};

export const LOCATIONS = {
    ALL: 'all',
};

export const STATUS_LABELS: Record<string, string> = {
    [SHIFT_STATUS.ALL]: 'All Status',
    [SHIFT_STATUS.PUBLISHED]: 'Published',
    [SHIFT_STATUS.OPEN]: 'Open',
    [SHIFT_STATUS.ASSIGNED]: 'Assigned',
    [SHIFT_STATUS.IN_PROGRESS]: 'In Progress',
    [SHIFT_STATUS.COMPLETED]: 'Completed',
    [SHIFT_STATUS.CANCELLED]: 'Cancelled',
    [SHIFT_STATUS.APPROVED]: 'Approved',
};

export function getApiBaseUrl() {
    const explicit = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SHIFTS_API_URL;
    if (explicit) {
        return explicit;
    }

    if (process.env.NODE_ENV === "production") {
        throw new Error("[WEB ENV] Missing NEXT_PUBLIC_API_URL or NEXT_PUBLIC_SHIFTS_API_URL.");
    }

    return "http://localhost:4005";
}
