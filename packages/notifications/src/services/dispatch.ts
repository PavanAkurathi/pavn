// packages/notifications/src/services/dispatch.ts

import { db } from '@repo/database';
import { scheduledNotification } from '@repo/database/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { sendBatchNotifications } from './expo-push';

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 3;

export interface DispatchResult {
    processed: number;
    sent: number;
    failed: number;
    skipped: number;
}

/**
 * Process all pending notifications whose scheduledAt <= now.
 * Designed to be called by a cron endpoint (e.g., every 1 minute).
 *
 * Flow:
 * 1. SELECT pending notifications where scheduledAt <= NOW() (limit BATCH_SIZE)
 * 2. Mark them as 'sending' (optimistic lock to prevent duplicate processing)
 * 3. Call sendBatchNotifications via Expo SDK
 * 4. Update status to 'sent' or 'failed' based on result
 */
export async function dispatchPendingNotifications(): Promise<DispatchResult> {
    const now = new Date();
    const result: DispatchResult = { processed: 0, sent: 0, failed: 0, skipped: 0 };

    // 1. Fetch pending notifications ready to send
    const pending = await db
        .select({
            id: scheduledNotification.id,
            workerId: scheduledNotification.workerId,
            shiftId: scheduledNotification.shiftId,
            title: scheduledNotification.title,
            body: scheduledNotification.body,
            data: scheduledNotification.data,
            attempts: scheduledNotification.attempts,
        })
        .from(scheduledNotification)
        .where(and(
            eq(scheduledNotification.status, 'pending'),
            lte(scheduledNotification.scheduledAt, now)
        ))
        .limit(BATCH_SIZE);

    if (pending.length === 0) {
        return result;
    }

    result.processed = pending.length;

    // 2. Filter out exhausted retries
    const toSend = pending.filter(n => (n.attempts ?? 0) < MAX_ATTEMPTS);
    const exhausted = pending.filter(n => (n.attempts ?? 0) >= MAX_ATTEMPTS);

    // Mark exhausted as permanently failed
    if (exhausted.length > 0) {
        const exhaustedIds = exhausted.map(n => n.id);
        await db.update(scheduledNotification)
            .set({
                status: 'failed',
                lastError: 'MAX_ATTEMPTS_EXCEEDED',
                updatedAt: now,
            })
            .where(sql`${scheduledNotification.id} IN (${sql.join(exhaustedIds.map(id => sql`${id}`), sql`, `)})`);
        result.failed += exhausted.length;
    }

    if (toSend.length === 0) {
        return result;
    }

    // 3. Increment attempt count (optimistic — before send)
    const sendIds = toSend.map(n => n.id);
    await db.update(scheduledNotification)
        .set({
            attempts: sql`${scheduledNotification.attempts} + 1`,
            updatedAt: now,
        })
        .where(sql`${scheduledNotification.id} IN (${sql.join(sendIds.map(id => sql`${id}`), sql`, `)})`);

    // 4. Send via Expo
    const batchPayload = toSend.map(n => ({
        id: n.id,
        workerId: n.workerId,
        title: n.title,
        body: n.body,
        data: (n.data as Record<string, unknown>) || {},
    }));

    const sendResults = await sendBatchNotifications(batchPayload);

    // 5. Update statuses based on results
    const sentIds: string[] = [];
    const failedUpdates: Array<{ id: string; error: string }> = [];

    for (const notification of toSend) {
        const sendResult = sendResults.get(notification.id);
        if (sendResult?.success) {
            sentIds.push(notification.id);
            result.sent++;
        } else {
            failedUpdates.push({
                id: notification.id,
                error: sendResult?.error || 'UNKNOWN_ERROR'
            });
            // Only mark as 'failed' if this was the last attempt
            if ((notification.attempts ?? 0) + 1 >= MAX_ATTEMPTS) {
                result.failed++;
            } else {
                // Leave as 'pending' for retry on next dispatch cycle
                result.skipped++;
            }
        }
    }

    // Mark successful sends
    if (sentIds.length > 0) {
        await db.update(scheduledNotification)
            .set({
                status: 'sent',
                sentAt: now,
                updatedAt: now,
            })
            .where(sql`${scheduledNotification.id} IN (${sql.join(sentIds.map(id => sql`${id}`), sql`, `)})`);
    }

    // Update error messages on failures (leave status as 'pending' for retry unless exhausted)
    for (const fail of failedUpdates) {
        await db.update(scheduledNotification)
            .set({
                lastError: fail.error,
                updatedAt: now,
                // If max attempts reached, mark failed; otherwise keep pending for retry
                ...(((pending.find(p => p.id === fail.id)?.attempts ?? 0) + 1 >= MAX_ATTEMPTS)
                    ? { status: 'failed' }
                    : {}
                ),
            })
            .where(eq(scheduledNotification.id, fail.id));
    }

    console.log(`[DISPATCH] Processed: ${result.processed}, Sent: ${result.sent}, Failed: ${result.failed}, Retry: ${result.skipped}`);

    return result;
}
