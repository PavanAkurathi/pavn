import { subMinutes, subDays, setHours, setMinutes, isAfter, addMinutes, format } from 'date-fns';
import { db } from '@repo/database';
import { workerNotificationPreferences, scheduledNotification } from '@repo/database/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { PushNotificationPayload } from '../types';

export type NotificationType =
    | 'assignment_created'
    | 'night_before'
    | '60_min'
    | '15_min'
    | 'shift_start'
    | 'late_warning'
    | 'geofence_arrive'
    | 'geofence_leave';

export interface ScheduledNotificationInsert {
    id: string;
    workerId: string;
    shiftId: string;
    organizationId: string;
    type: NotificationType;
    title: string;
    body: string;
    data: Record<string, unknown>;
    scheduledAt: Date;
    status: 'pending';
}

interface NotificationTemplate {
    type: NotificationType;
    title: string;
    body: string;
    getScheduledTime: (shiftStart: Date) => Date;
    preferenceKey?: keyof WorkerPreferences;
}

interface WorkerPreferences {
    nightBeforeEnabled: boolean;
    sixtyMinEnabled: boolean;
    fifteenMinEnabled: boolean;
    shiftStartEnabled: boolean;
    lateWarningEnabled: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
}

const DEFAULT_PREFERENCES: WorkerPreferences = {
    nightBeforeEnabled: true,
    sixtyMinEnabled: true,
    fifteenMinEnabled: true,
    shiftStartEnabled: true,
    lateWarningEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
};

/**
 * Build notification schedule for a shift assignment
 */
export async function buildNotificationSchedule(
    workerId: string,
    shiftId: string,
    organizationId: string,
    shiftStart: Date,
    shiftTitle: string,
    venueName: string,
    preFetchedPrefs?: WorkerPreferences // Optimization: Allow injection to avoid N+1
): Promise<ScheduledNotificationInsert[]> {
    const now = new Date();
    const notifications: ScheduledNotificationInsert[] = [];

    // Fetch worker preferences (or use injected)
    const prefs = preFetchedPrefs || await getWorkerPreferences(workerId);

    // Define notification templates
    const templates: NotificationTemplate[] = [
        {
            type: 'assignment_created',
            title: 'New Shift Scheduled',
            body: `You've been scheduled for ${shiftTitle} at ${venueName} on ${format(shiftStart, "MMM d")} at ${format(shiftStart, "h:mm a")}`,
            getScheduledTime: () => addMinutes(new Date(), 1), // Scheduling 1 min in future ensures it passes "isAfter(now)" check
            // No preference key = Always send (Transactional)
        },
        {
            type: 'night_before',
            title: 'Shift Tomorrow',
            body: `You have a ${shiftTitle} shift at ${venueName} tomorrow. Get some rest!`,
            getScheduledTime: (start) => setMinutes(setHours(subDays(start, 1), 20), 0), // 8 PM night before
            preferenceKey: 'nightBeforeEnabled',
        },
        {
            type: '60_min',
            title: 'Shift in 1 Hour',
            body: `Your shift starts in 1 hour at ${venueName}`,
            getScheduledTime: (start) => subMinutes(start, 60),
            preferenceKey: 'sixtyMinEnabled',
        },
        {
            type: '15_min',
            title: 'Shift Starting Soon',
            body: `Your shift starts in 15 minutes. Enable location to clock in when you arrive.`,
            getScheduledTime: (start) => subMinutes(start, 15),
            preferenceKey: 'fifteenMinEnabled',
        },
        {
            type: 'shift_start',
            title: 'You need to arrive',
            body: `Arrived at ${venueName}? Clock in when ready`,
            getScheduledTime: (start) => start,
            preferenceKey: 'shiftStartEnabled',
        },
        {
            type: 'late_warning',
            title: 'Forgot to Clock In?',
            body: `Looks like you forgot to clock in for ${shiftTitle} at ${venueName}. Clock in now or contact your manager`,
            getScheduledTime: (start) => addMinutes(start, 30),
            preferenceKey: 'lateWarningEnabled',
        },
    ];

    for (const template of templates) {
        // Check if preference enabled (if key exists)
        if (template.preferenceKey && !prefs[template.preferenceKey]) {
            continue;
        }

        const scheduledAt = template.getScheduledTime(shiftStart);

        // Skip if in the past (Allow assignment_created to proceed even if close to boundary, but addMinutes(1) handles it)
        if (!isAfter(scheduledAt, now)) {
            continue;
        }

        // Check quiet hours
        if (prefs.quietHoursEnabled && isInQuietHours(scheduledAt, prefs)) {
            // For night_before, skip entirely during quiet hours
            if (template.type === 'night_before') {
                continue;
            }
            // For shift-critical notifications (assignment_created, 15_min, shift_start, late_warning), send anyway
            // For 60_min, skip if in quiet hours (non-critical reminder)
            if (template.type === '60_min') {
                continue;
            }
        }

        notifications.push({
            id: nanoid(),
            workerId,
            shiftId,
            organizationId,
            type: template.type,
            title: template.title,
            body: template.body,
            data: {
                screen: template.type === 'late_warning' ? 'ClockIn' : 'ShiftDetails',
                shiftId,
            },
            scheduledAt,
            status: 'pending',
        });
    }

    return notifications;
}

/**
 * Get worker preferences with defaults
 */
async function getWorkerPreferences(workerId: string): Promise<WorkerPreferences> {
    const prefs = await db.query.workerNotificationPreferences.findFirst({
        where: eq(workerNotificationPreferences.workerId, workerId)
    });

    if (!prefs) {
        return DEFAULT_PREFERENCES;
    }

    return {
        nightBeforeEnabled: prefs.nightBeforeEnabled ?? true,
        sixtyMinEnabled: prefs.sixtyMinEnabled ?? true,
        fifteenMinEnabled: prefs.fifteenMinEnabled ?? true,
        shiftStartEnabled: prefs.shiftStartEnabled ?? true,
        lateWarningEnabled: prefs.lateWarningEnabled ?? true,
        quietHoursEnabled: prefs.quietHoursEnabled ?? false,
        quietHoursStart: prefs.quietHoursStart,
        quietHoursEnd: prefs.quietHoursEnd,
    };
}

/**
 * Check if a time falls within quiet hours
 */
function isInQuietHours(time: Date, prefs: WorkerPreferences): boolean {
    if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
        return false;
    }

    const timeHour = time.getHours();
    const timeMinute = time.getMinutes();
    const timeMinutes = timeHour * 60 + timeMinute;

    const startParts = prefs.quietHoursStart.split(':').map(Number);
    const endParts = prefs.quietHoursEnd.split(':').map(Number);

    const startHour = startParts[0] ?? 0;
    const startMin = startParts[1] ?? 0;
    const endHour = endParts[0] ?? 0;
    const endMin = endParts[1] ?? 0;

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 - 07:00)
    if (startMinutes > endMinutes) {
        // Quiet hours span midnight
        return timeMinutes >= startMinutes || timeMinutes < endMinutes;
    } else {
        // Same day quiet hours
        return timeMinutes >= startMinutes && timeMinutes < endMinutes;
    }
}

/**
 * Cancel all pending notifications for a shift
 */
export async function cancelShiftNotifications(shiftId: string): Promise<number> {
    const result = await db.update(scheduledNotification)
        .set({
            status: 'cancelled',
            updatedAt: new Date()
        })
        .where(and(
            eq(scheduledNotification.shiftId, shiftId),
            eq(scheduledNotification.status, 'pending')
        ))
        .returning({ id: scheduledNotification.id });

    return result.length;
}

/**
 * Cancel specific notification type for an assignment
 */
export async function cancelNotificationByType(
    shiftId: string,
    workerId: string,
    type: NotificationType
): Promise<boolean> {
    const result = await db.update(scheduledNotification)
        .set({
            status: 'cancelled',
            updatedAt: new Date()
        })
        .where(and(
            eq(scheduledNotification.shiftId, shiftId),
            eq(scheduledNotification.workerId, workerId),
            eq(scheduledNotification.type, type),
            eq(scheduledNotification.status, 'pending')
        ))
        .returning({ id: scheduledNotification.id });

    return result.length > 0;
}
