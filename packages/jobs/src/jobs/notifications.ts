// packages/jobs/src/jobs/notifications.ts

import { task, schedules } from "@trigger.dev/sdk/v3";
import { db } from "@repo/database";
import { scheduledNotification, deviceToken } from "@repo/database/schema";
import { eq, and, lte, sql } from "drizzle-orm";

/**
 * Send Scheduled Notifications Job
 * 
 * Runs every minute to process pending notifications.
 * Uses Expo Push Notifications API.
 */
export const sendScheduledNotifications = schedules.task({
    id: "send-scheduled-notifications",
    cron: "* * * * *",
    run: async () => {
        const now = new Date();
        
        const pendingNotifications = await db.query.scheduledNotification.findMany({
            where: and(
                eq(scheduledNotification.status, "pending"),
                lte(scheduledNotification.scheduledAt, now)
            ),
            limit: 100,
            with: {
                worker: true,
            },
        });
        
        if (pendingNotifications.length === 0) {
            return { processed: 0 };
        }
        
        console.log(`[NOTIFICATIONS] Processing ${pendingNotifications.length} notifications`);
        
        let sent = 0;
        let failed = 0;
        
        for (const notification of pendingNotifications) {
            try {
                const tokens = await db.query.deviceToken.findMany({
                    where: and(
                        eq(deviceToken.userId, notification.workerId),
                        eq(deviceToken.isActive, true)
                    ),
                });
                
                if (tokens.length === 0) {
                    await db.update(scheduledNotification)
                        .set({
                            status: "failed",
                            lastError: "No active device tokens",
                            attempts: sql`${scheduledNotification.attempts} + 1`,
                            updatedAt: now,
                        })
                        .where(eq(scheduledNotification.id, notification.id));
                    failed++;
                    continue;
                }
                
                const pushTokens = tokens.map(t => t.pushToken);
                
                const response = await fetch("https://exp.host/--/api/v2/push/send", {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(
                        pushTokens.map(token => ({
                            to: token,
                            title: notification.title,
                            body: notification.body,
                            data: notification.data,
                            sound: "default",
                            priority: "high",
                        }))
                    ),
                });
                
                if (!response.ok) {
                    throw new Error(`Expo API error: ${response.status}`);
                }
                
                await db.update(scheduledNotification)
                    .set({
                        status: "sent",
                        sentAt: now,
                        updatedAt: now,
                    })
                    .where(eq(scheduledNotification.id, notification.id));
                
                sent++;
            } catch (error) {
                console.error(`[NOTIFICATIONS] Failed to send ${notification.id}:`, error);
                
                const attempts = (notification.attempts || 0) + 1;
                const maxAttempts = 3;
                
                await db.update(scheduledNotification)
                    .set({
                        status: attempts >= maxAttempts ? "failed" : "pending",
                        lastError: error instanceof Error ? error.message : String(error),
                        attempts,
                        updatedAt: now,
                    })
                    .where(eq(scheduledNotification.id, notification.id));
                
                failed++;
            }
        }
        
        return { processed: pendingNotifications.length, sent, failed };
    },
});

/**
 * Late Worker Alert Job
 * 
 * Runs every 5 minutes to check for workers who haven't clocked in
 * 15 minutes after shift start.
 */
export const lateWorkerAlert = schedules.task({
    id: "late-worker-alert",
    cron: "*/5 * * * *",
    run: async () => {
        const now = new Date();
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
        
        // Find shifts that started 15+ mins ago with unclocked workers
        const lateWorkers = await db.execute(sql`
            SELECT 
                sa.id as assignment_id,
                sa.worker_id,
                s.id as shift_id,
                s.title as shift_title,
                s.start_time,
                s.organization_id,
                u.name as worker_name
            FROM shift_assignment sa
            JOIN shift s ON sa.shift_id = s.id
            JOIN "user" u ON sa.worker_id = u.id
            WHERE s.start_time <= ${fifteenMinutesAgo}
                AND s.start_time > ${new Date(now.getTime() - 60 * 60 * 1000)}
                AND sa.clock_in IS NULL
                AND sa.late_alert_sent = false
                AND s.status IN ('assigned', 'in-progress')
        `);
        
        console.log(`[LATE_ALERT] Found ${lateWorkers.rows?.length || 0} late workers`);
        
        for (const worker of (lateWorkers.rows || [])) {
            // Send alert to managers
            // TODO: Implement manager notification
            
            // Mark alert as sent
            await db.execute(sql`
                UPDATE shift_assignment 
                SET late_alert_sent = true, updated_at = NOW()
                WHERE id = ${worker.assignment_id}
            `);
        }
        
        return { alertsSent: lateWorkers.rows?.length || 0 };
    },
});
