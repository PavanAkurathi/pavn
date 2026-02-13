
// packages/shifts/src/types.ts

export type ShiftStatus = 'draft' | 'published' | 'open' | 'assigned' | 'in-progress' | 'completed' | 'cancelled' | 'approved';

export interface Shift {
    id: string;
    title: string;          // Role Name
    description?: string;   // Schedule Name (for drafts)
    locationId?: string;
    locationName: string;
    locationAddress?: string;
    geofenceRadius?: number; // [UX-008] Enforce consistency
    contactId?: string | null;  // For re-hydrating drafts
    startTime: string; // ISO string
    endTime: string;   // ISO string
    status: ShiftStatus;
    workerId?: string;
    // price?: number; // REMOVED per TICKET-005
    capacity?: {
        filled: number;
        total: number;
    };
    assignedWorkers?: {
        id: string;
        name?: string;
        avatarUrl?: string;
        initials: string;
    }[];
}

export interface TimesheetWorker {
    id: string;
    name: string;
    avatarUrl?: string;
    avatarInitials: string;
    role: string;
    // hourlyRate: number; // REMOVED per TICKET-005/008
    clockIn?: string; // ISO string
    clockOut?: string; // ISO string
    breakMinutes: number;
    status: 'rostered' | 'new' | 'blocked' | 'submitted' | 'approved' | 'no-show' | 'cancelled';
}
