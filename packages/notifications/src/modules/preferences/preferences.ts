import { db } from "@repo/database";
import {
    managerNotificationPreferences,
    workerNotificationPreferences,
} from "@repo/database/schema";
import { eq } from "drizzle-orm";

type WorkerPreferenceUpdate = {
    nightBeforeEnabled?: boolean;
    sixtyMinEnabled?: boolean;
    fifteenMinEnabled?: boolean;
    shiftStartEnabled?: boolean;
    lateWarningEnabled?: boolean;
    geofenceAlertsEnabled?: boolean;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
};

type ManagerPreferenceUpdate = {
    clockInAlertsEnabled?: boolean;
    clockOutAlertsEnabled?: boolean;
    shiftScope?: "all" | "booked_by_me" | "onsite_contact";
    locationScope?: "all" | "selected";
};

export async function getWorkerPreferences(userId: string) {
    let prefs = await db.query.workerNotificationPreferences.findFirst({
        where: eq(workerNotificationPreferences.workerId, userId),
    });

    if (!prefs) {
        [prefs] = await db.insert(workerNotificationPreferences)
            .values({
                workerId: userId,
            })
            .returning();
    }

    return prefs;
}

export async function updateWorkerPreferences(
    userId: string,
    payload: WorkerPreferenceUpdate,
) {
    const [updatedPrefs] = await db.insert(workerNotificationPreferences)
        .values({
            workerId: userId,
            ...payload,
        })
        .onConflictDoUpdate({
            target: workerNotificationPreferences.workerId,
            set: {
                ...payload,
                updatedAt: new Date(),
            },
        })
        .returning();

    return updatedPrefs;
}

export async function getManagerPreferences(userId: string) {
    let prefs = await db.query.managerNotificationPreferences.findFirst({
        where: eq(managerNotificationPreferences.managerId, userId),
    });

    if (!prefs) {
        [prefs] = await db.insert(managerNotificationPreferences)
            .values({
                managerId: userId,
                clockInAlertsEnabled: true,
                clockOutAlertsEnabled: true,
                shiftScope: "all",
                locationScope: "all",
            })
            .returning();
    }

    return prefs;
}

export async function updateManagerPreferences(
    userId: string,
    payload: ManagerPreferenceUpdate,
) {
    const [updatedPrefs] = await db.insert(managerNotificationPreferences)
        .values({
            managerId: userId,
            ...payload,
        })
        .onConflictDoUpdate({
            target: managerNotificationPreferences.managerId,
            set: {
                ...payload,
                updatedAt: new Date(),
            },
        })
        .returning();

    return updatedPrefs;
}
