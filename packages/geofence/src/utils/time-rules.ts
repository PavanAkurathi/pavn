// packages/geofence/src/utils/time-rules.ts

export interface ClockInResult {
    recordedTime: Date;
    actualTime: Date;
    scheduledTime: Date;
    isEarly: boolean;
    isLate: boolean;
    minutesDifference: number;  // Positive = late, Negative = early
}

export interface ClockOutResult {
    recordedTime: Date;
    actualTime: Date;
    scheduledTime: Date;
    isEarly: boolean;
    isLate: boolean;
    minutesDifference: number;
}

/**
 * Apply clock-in time rules
 * - Early arrival → record scheduled time
 * - Late arrival → record actual time
 */
export function applyClockInRules(
    actualTime: Date,
    scheduledStartTime: Date
): ClockInResult {
    const diffMs = actualTime.getTime() - scheduledStartTime.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));

    const isEarly = diffMinutes < 0;
    const isLate = diffMinutes > 0;

    // If early, record scheduled time. If late or on-time, record actual.
    const recordedTime = isEarly ? scheduledStartTime : actualTime;

    return {
        recordedTime,
        actualTime,
        scheduledTime: scheduledStartTime,
        isEarly,
        isLate,
        minutesDifference: diffMinutes,
    };
}

/**
 * Apply clock-out time rules
 * - Early departure → record actual time (manager sees gap)
 * - Late departure → record scheduled time (no free overtime)
 */
export function applyClockOutRules(
    actualTime: Date,
    scheduledEndTime: Date
): ClockOutResult {
    const diffMs = actualTime.getTime() - scheduledEndTime.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));

    const isEarly = diffMinutes < 0;
    const isLate = diffMinutes > 0;

    // If late, cap at scheduled time. If early or on-time, record actual.
    const recordedTime = isLate ? scheduledEndTime : actualTime;

    return {
        recordedTime,
        actualTime,
        scheduledTime: scheduledEndTime,
        isEarly,
        isLate,
        minutesDifference: diffMinutes,
    };
}

/**
 * Grace period check - is the worker within acceptable range of shift time?
 * Used to determine if clock-in/out is valid
 */
export function isWithinGracePeriod(
    actualTime: Date,
    targetTime: Date,
    graceMinutes: number = 30
): boolean {
    const diffMs = Math.abs(actualTime.getTime() - targetTime.getTime());
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes <= graceMinutes;
}
