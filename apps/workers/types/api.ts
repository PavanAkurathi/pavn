// apps/workers/types/api.ts
// Shared API Types for Mobile App

// =============================================================================
// SHIFT TYPES
// =============================================================================

export type ShiftStatus =
    | 'draft'
    | 'published'
    | 'assigned'
    | 'in-progress'
    | 'completed'
    | 'approved'
    | 'cancelled';

export interface Location {
    id: string;
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    geofenceRadius?: number;
}

export interface Organization {
    id: string;
    name: string;
}

// ShiftPay removed per TICKET-007

export interface Timesheet {
    clockIn?: string;
    clockOut?: string;
    clockInMethod?: 'geofence' | 'manual' | 'correction';
    clockOutMethod?: 'geofence' | 'manual' | 'correction';
    clockInVerified?: boolean;
    clockOutVerified?: boolean;
    breakMinutes?: number;
}

export interface WorkerShift {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    status: ShiftStatus;
    location: Location;
    organization: Organization;
    // pay: ShiftPay; // REMOVED per TICKET-007
    timesheet: Timesheet;
    assignmentId?: string;
    notes?: string;
}

// =============================================================================
// CLOCK IN/OUT TYPES
// =============================================================================

export interface ClockRequest {
    shiftId: string;
    latitude: string;
    longitude: string;
    accuracyMeters?: number;
    deviceTimestamp: string;
}

export interface ClockResponse {
    success: boolean;
    clockTime: string;
    method: 'geofence' | 'manual';
    verified: boolean;
    distance?: number;
    message?: string;
}

// =============================================================================
// ADJUSTMENT TYPES
// =============================================================================

export interface CreateAdjustmentRequest {
    shiftAssignmentId: string;
    reason: string;
    requestedClockIn?: string;
    requestedClockOut?: string;
    requestedBreakMinutes?: number;
}

export interface Adjustment {
    id: string;
    shiftAssignmentId: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'escalated';
    requestedClockIn?: string;
    requestedClockOut?: string;
    requestedBreakMinutes?: number;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewNotes?: string;
    createdAt: string;
}

// =============================================================================
// AVAILABILITY TYPES
// =============================================================================

export interface AvailabilitySlot {
    id: string;
    dayOfWeek: number; // 0-6 (Sunday-Saturday)
    startTime: string; // HH:MM format
    endTime: string;   // HH:MM format
    isAvailable: boolean;
}

export interface AvailabilityException {
    id: string;
    date: string;
    isAvailable: boolean;
    reason?: string;
}

// =============================================================================
// PREFERENCES TYPES
// =============================================================================

export interface WorkerPreferences {
    // Notification preferences
    nightBeforeEnabled: boolean;
    sixtyMinEnabled: boolean;
    fifteenMinEnabled: boolean;
    shiftStartEnabled: boolean;
    lateWarningEnabled: boolean;
    geofenceAlertsEnabled: boolean;

    // Quiet hours
    quietHoursEnabled: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
}

// =============================================================================
// USER TYPES
// =============================================================================

export interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
    image?: string;
}

export interface Session {
    user: User;
    activeOrganizationId?: string;
    expiresAt: string;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
}

export interface ShiftsListResponse {
    shifts: WorkerShift[];
    pagination?: {
        total: number;
        limit: number;
        offset: number;
    };
}
