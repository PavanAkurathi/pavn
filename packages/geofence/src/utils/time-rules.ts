// packages/geofence/src/utils/time-rules.ts

interface ClockInResult {
    recordedTime: Date;
    actualTime: Date;
    scheduledTime: Date;
    isEarly: boolean;
    isLate: boolean;
    minutesDifference: number;
}

/**
 * Applies business rules for clocking in.
 * - Caps early clock-ins to scheduled start time (if within buffer)
 * - Flags late clock-ins
 */
export function applyClockInRules(actualTime: Date, scheduledTime: Date): ClockInResult {
    const diffMs = actualTime.getTime() - scheduledTime.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    const isEarly = diffMinutes < 0;
    const isLate = diffMinutes > 0; // Strict lateness for now, could add 5 min grace period

    // Rule: If clocking in early (within buffer), we might want to record the actual time
    // but Pay calculation might eventually snap to scheduled start.
    // For this function, we just return the analysis.
    // The requirement often is: "If I arrive 10 mins early, pay me from Scheduled Start".
    // If I arrive late, pay me from Actual Arrival.

    // However, for the 'clockIn' field in DB, we usually store ACTUAL time for liability/audit,
    // and handle "rounding" in the pay calculation/timesheet generation service.
    // BUT, some systems snap the 'clockIn' timestamp itself.

    // Decision: Store ACTUAL time as 'clockIn' usually, unless specific business rule overrides.
    // We will return recordedTime = actualTime, but flag it. 

    // If requirement says "Prevent early clock in > 15 mins", that's handled in controller.

    return {
        recordedTime: actualTime,
        actualTime: actualTime,
        scheduledTime: scheduledTime,
        isEarly,
        isLate,
        minutesDifference: diffMinutes
    };
}

interface ClockOutResult {
    recordedTime: Date;
    actualTime: Date;
    scheduledTime: Date;
    isEarly: boolean;
    isLate: boolean;
    minutesDifference: number;
}

/**
 * Applies business rules for clocking out.
 * - Flags early clock-outs (left before scheduled end)
 * - Flags late clock-outs (stayed past scheduled end)
 * 
 * Note: We record ACTUAL time for audit purposes.
 * Pay rounding/capping is handled in the approval/payroll step.
 */
export function applyClockOutRules(actualTime: Date, scheduledTime: Date): ClockOutResult {
    const diffMs = actualTime.getTime() - scheduledTime.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    const isEarly = diffMinutes < 0;  // Left before scheduled end
    const isLate = diffMinutes > 0;   // Stayed past scheduled end

    return {
        recordedTime: actualTime,
        actualTime,
        scheduledTime,
        isEarly,
        isLate,
        minutesDifference: diffMinutes
    };
}

interface BreakEnforcementResult {
    breakMinutes: number;
    wasEnforced: boolean;
    reason?: string;
}

/**
 * Enforces mandatory break rules based on shift duration
 * 
 * US Labor Standards (Simplified for MVP):
 * - < 6 hours: No mandatory break
 * - 6+ hours: 30 min unpaid break (mandatory)
 */
export function enforceBreakRules(
    clockIn: Date,
    clockOut: Date,
    recordedBreaks: number,
    state: 'MA' | 'CA' | 'NY' | 'default' = 'default'
): BreakEnforcementResult {
    const totalMinutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);
    const totalHours = totalMinutes / 60;

    // If worker already took breaks, don't override
    if (recordedBreaks > 0) {
        return {
            breakMinutes: recordedBreaks,
            wasEnforced: false
        };
    }

    // Shift under 6 hours - no break required
    if (totalHours < 6) {
        return {
            breakMinutes: 0,
            wasEnforced: false
        };
    }

    // 6+ hours: Mandatory 30 min unpaid break
    // In a real app, complex state logic (CA vs MA) would go here.
    return {
        breakMinutes: 30,
        wasEnforced: true,
        reason: `Mandatory 30min break for ${totalHours.toFixed(1)}hr shift`
    };
}
