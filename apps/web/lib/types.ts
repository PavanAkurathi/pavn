export * from "@repo/shifts-service";

export type ViewMode = 'list' | 'calendar';

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
