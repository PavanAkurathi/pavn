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
    scheduledMinutes?: number;
    jobTitle: string;
    clockIn: string;
    clockOut: string;
    breakDuration: string;
    breakOneDuration?: string;
    breakTwoDuration?: string;
    notes?: string;
}

export function parseBreakMinutes(value?: string | null) {
    if (!value) return 0;

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function splitBreakMinutes(totalMinutes: number) {
    if (totalMinutes <= 0) {
        return {
            breakOneDuration: "0 min",
            breakTwoDuration: "0 min",
        };
    }

    if (totalMinutes <= 30) {
        return {
            breakOneDuration: `${totalMinutes} min`,
            breakTwoDuration: "0 min",
        };
    }

    return {
        breakOneDuration: "30 min",
        breakTwoDuration: `${Math.max(0, totalMinutes - 30)} min`,
    };
}

export function getRecommendedBreakMinutes(scheduledMinutes?: number) {
    if (!scheduledMinutes) return 0;

    if (scheduledMinutes >= 8 * 60) {
        return 45;
    }

    if (scheduledMinutes >= 6 * 60) {
        return 30;
    }

    if (scheduledMinutes >= 4 * 60) {
        return 15;
    }

    return 0;
}

export function combineBreakDurations(worker: Partial<TimesheetViewModel>) {
    const breakOneMinutes = parseBreakMinutes(worker.breakOneDuration);
    const breakTwoMinutes = parseBreakMinutes(worker.breakTwoDuration);

    if (breakOneMinutes || breakTwoMinutes) {
        return breakOneMinutes + breakTwoMinutes;
    }

    return parseBreakMinutes(worker.breakDuration);
}

export function workerNeedsAttention(worker: Partial<TimesheetViewModel>) {
    const status = getWorkerStatus(worker);

    return (
        status.clockInVariant !== "default" ||
        status.clockOutVariant !== "default" ||
        status.breakVariant !== "default"
    );
}

function parseDisplayTimeToMinutes(time: string | undefined) {
    if (!time) return null;

    const [rawTime, period] = time.trim().split(" ");
    if (!rawTime || !period) return null;

    const [hoursString, minutesString] = rawTime.split(":");
    if (!hoursString || !minutesString) return null;

    const hours = Number.parseInt(hoursString, 10);
    const minutes = Number.parseInt(minutesString, 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

    let normalizedHours = hours % 12;
    if (period.toUpperCase() === "PM") {
        normalizedHours += 12;
    }

    return normalizedHours * 60 + minutes;
}

export function calculateTrackedMinutes(worker: Partial<TimesheetViewModel>) {
    const clockInMinutes = parseDisplayTimeToMinutes(worker.clockIn);
    const clockOutMinutes = parseDisplayTimeToMinutes(worker.clockOut);

    if (clockInMinutes === null || clockOutMinutes === null) {
        return 0;
    }

    const normalizedBreakMinutes = combineBreakDurations(worker);
    const workedMinutes =
        clockOutMinutes >= clockInMinutes
            ? clockOutMinutes - clockInMinutes
            : (24 * 60 - clockInMinutes) + clockOutMinutes;

    return Math.max(0, workedMinutes - normalizedBreakMinutes);
}

export function formatTrackedMinutes(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
        return `${minutes} mins`;
    }

    if (minutes === 0) {
        return `${hours} hrs`;
    }

    return `${hours} hrs, ${minutes} mins`;
}

/**
 * Calculates the status variants for a worker's timesheet based on clock-in/out times and break duration.
 */
export const getWorkerStatus = (worker: Partial<TimesheetViewModel>): TimesheetStatus => {
    let clockInVariant: "default" | "destructive" | "warning" = "default";
    let clockOutVariant: "default" | "destructive" | "warning" = "default";
    let breakVariant: "default" | "destructive" | "warning" = "default";
    const combinedBreakMinutes = combineBreakDurations(worker);
    const recommendedBreakMinutes = getRecommendedBreakMinutes(worker.scheduledMinutes);

    // Clock In Logic
    if (!worker.clockIn) {
        clockInVariant = "destructive"; // Missing = Red
    }

    // Clock Out Logic
    if (worker.clockIn && !worker.clockOut) {
        clockOutVariant = "destructive"; // Missing = Red
    }

    // Break Logic
    if (recommendedBreakMinutes > 0 && combinedBreakMinutes < recommendedBreakMinutes) {
        breakVariant = "warning";
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
