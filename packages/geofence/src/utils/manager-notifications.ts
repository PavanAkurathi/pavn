import { db } from "@repo/database";
import { member, managerNotificationPreferences, deviceToken } from "@repo/database/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sendBatchNotifications } from "@repo/notifications";
import { nanoid } from "nanoid";

export type ManagerEventType = 'clock-in' | 'clock-out';

export async function notifyManagers(
    eventType: ManagerEventType,
    shift: { id: string, title: string, locationId: string | null, contactId: string | null, organizationId: string },
    workerName: string
) {
    try {
        const orgId = shift.organizationId;

        // 1. Get all admins/managers of the org
        const members = await db.select({
            userId: member.userId,
            role: member.role,
        })
            .from(member)
            .where(eq(member.organizationId, orgId));

        if (members.length === 0) return;

        const memberIds = members.map(m => m.userId);

        // 2. Fetch Preferences for these users
        const preferences = await db.query.managerNotificationPreferences.findMany({
            where: inArray(managerNotificationPreferences.managerId, memberIds)
        });

        const prefMap = new Map(preferences.map(p => [p.managerId, p]));

        // 3. Filter Recipients
        const recipients: string[] = [];

        for (const m of members) {
            const pref = prefMap.get(m.userId);

            if (!pref) continue;

            if (eventType === 'clock-in' && !pref.clockInAlertsEnabled) continue;
            if (eventType === 'clock-out' && !pref.clockOutAlertsEnabled) continue;

            if (pref.shiftScope === 'onsite_contact') {
                if (shift.contactId !== m.userId) continue;
            }

            if (pref.shiftScope === 'booked_by_me') {
                continue;
            }

            if (pref.locationScope === 'selected') {
                continue;
            }

            recipients.push(m.userId);
        }

        if (recipients.length === 0) return;

        // 4. Send Batch Notifications
        // sendBatchNotifications expects { id, workerId, title, body, data }
        // Here 'workerId' refers to the recipient's userId (manager).
        const payload = recipients.map(recipientId => ({
            id: nanoid(),
            workerId: recipientId, // The Manager is the "worker" receiving the push
            title: eventType === 'clock-in' ? 'Worker Clocked In' : 'Worker Clocked Out',
            body: `${workerName} has ${eventType === 'clock-in' ? 'clocked in' : 'clocked out'} for ${shift.title}.`,
            data: { shiftId: shift.id, type: 'manager_alert' }
        }));

        await sendBatchNotifications(payload);

        console.log(`[NOTIFY_MANAGERS] Sent ${payload.length} alerts for ${eventType}`);

    } catch (error) {
        console.error("[NOTIFY_MANAGERS] Failed:", error);
    }
}
