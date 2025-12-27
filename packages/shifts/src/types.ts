export type ShiftStatus = 'open' | 'assigned' | 'in-progress' | 'completed' | 'cancelled' | 'approved';

export interface Shift {
    id: string;
    title: string;
    locationId?: string;
    locationName: string;
    locationAddress?: string;
    startTime: string; // ISO string
    endTime: string;   // ISO string
    status: ShiftStatus;
    workerId?: string;
    price?: number;
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
    hourlyRate: number;
    clockIn?: string; // ISO string
    clockOut?: string; // ISO string
    breakMinutes: number;
    status: 'rostered' | 'new' | 'blocked' | 'submitted';
}
