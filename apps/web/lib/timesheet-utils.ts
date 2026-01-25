import { TimesheetWorker } from "@/lib/types";

export interface TimesheetStatus {
    clockInVariant: "default" | "destructive" | "warning";
    clockOutVariant: "default" | "destructive" | "warning";
    breakVariant: "default" | "destructive" | "warning";
}

export interface UpdateTimesheetPayload {
    clockIn?: string | null;
    clockOut?: string | null;
    breakMinutes?: number;
}


export interface TimesheetViewModel {
    id: string;
    name: string;
    avatar?: string;
    initials?: string;
    shiftDuration: string;
    hourlyRate: string;
    clockIn: string;
    clockOut: string;
    breakDuration: string;
    rating?: number;
}

/**
 * Calculates the status variants for a worker's timesheet based on clock-in/out times and break duration.
 */
export const getWorkerStatus = (worker: Partial<TimesheetViewModel>): TimesheetStatus => {
    let clockInVariant: "default" | "destructive" | "warning" = "default";
    let clockOutVariant: "default" | "destructive" | "warning" = "default";
    let breakVariant: "default" | "destructive" | "warning" = "default";

    // Clock In Logic
    if (!worker.clockIn) {
        clockInVariant = "destructive"; // Missing = Red
    } else if (worker.clockIn !== "05:00 PM" && worker.clockIn !== "05:00 AM") {
        // TODO: This hardcoded check for 5:00 is specific to the current mock data/business logic.
        // Ideally this should compare against the shift start time with a grace period.
        clockInVariant = "destructive"; // Late = Red
    }

    // Clock Out Logic
    if (!worker.clockOut) {
        clockOutVariant = "destructive"; // Missing = Red
    } else if (worker.clockOut === "12:00 AM" || worker.clockOut > "11:30 PM") {
        clockOutVariant = "warning"; // OT = Amber
    }

    // Break Logic
    if (!worker.breakDuration || worker.breakDuration === "0 min") {
        breakVariant = "destructive"; // Missing/Zero = Red
    }

    return { clockInVariant, clockOutVariant, breakVariant };
};

/**
 * Parses a time string (e.g., "05:00 PM") into an ISO Date string relative to a base date.
 * Handles "12" hour logic for AM/PM.
 */
export const parseTimeStringToIso = (timeStr: string | undefined | null, baseDate: Date): string | undefined => {
    if (!timeStr) return undefined;

    // Parse "05:00 PM"
    const parts = timeStr.trim().split(' ');
    if (parts.length < 2) return undefined;

    const [time, period] = parts;
    if (!time) return undefined;

    const timeParts = time.split(':');
    if (timeParts.length < 2) return undefined;

    const hoursStr = timeParts[0];
    const minutesStr = timeParts[1];

    if (!hoursStr || !minutesStr) return undefined;

    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (isNaN(hours) || isNaN(minutes)) return undefined;

    let date = new Date(baseDate);
    let h = hours;

    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;

    date.setHours(h, minutes, 0, 0);

    return date.toISOString();
};
