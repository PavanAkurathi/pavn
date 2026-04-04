export type {
    Shift,
    ShiftStatus,
    TimesheetWorker,
} from "@repo/contracts/shifts";

export type ShiftLayout = "weekly" | "list" | "month";

export interface Location {
    id: string;
    name: string;
    address: string;
    timezone?: string;
}

export interface Contact {
    id: string;
    memberId?: string;
    userId: string;
    name: string;
    phone: string;
    initials: string;
    role: string;
}
