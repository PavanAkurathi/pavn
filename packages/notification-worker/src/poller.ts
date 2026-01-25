import { db } from '@repo/database';
import { scheduledNotification } from '@repo/database/schema';
import { eq, and, lte, sql, inArray } from 'drizzle-orm';
import { sendBatchNotifications } from '@repo/notifications';

const BATCH_SIZE = 50;

export async function processNotifications() {
    try {
        const now = new Date();

        // 1. Fetch pending notifications with row locking (SKIP LOCKED)
        // Drizzle doesn't native support FOR UPDATE SKIP LOCKED in query builder easily purely via type-safe methods for 'findMany',
        // so we use a transaction or sql builder.
        // For simple polling, we can grab IDs first.

        // Strategy: 
        // 1. SELECT pending IDs that are due.
        // 2. MARK them as 'processing' to lock them (or use atomic update).
        // Since we don't have 'processing' status in schema (only pending/sent/failed), 
        // we can use the "attempts" or just optimistic locking if we had versioning.
        // But the robust way for Postgres queues is:

        const pending = await db.execute(sql`
            UPDATE scheduled_notifications
            SET status = 'processing', updated_at = NOW()
            WHERE id IN (
                SELECT id
                FROM scheduled_notifications
                WHERE status = 'pending'
                AND scheduled_at <= ${now}
                ORDER BY scheduled_at ASC
                LIMIT ${BATCH_SIZE}
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, worker_id, title, body, data
        `);

        // Drizzle .execute returns array of rows directly? Or dependent on driver?
        // With bun:sqlite / postgres.js it varies. 
        // Let's assume standard postgres return shape or cast it.
        const rows = pending as unknown as Array<{
            id: string;
            worker_id: string;
            title: string;
            body: string;
            data: unknown
        }>;

        if (rows.length === 0) {
            return; // Nothing to do
        }

        console.log(`[WORKER] Processing ${rows.length} notifications`);

        // 2. Send Batch
        const results = await sendBatchNotifications(
            rows.map(r => ({
                id: r.id,
                workerId: r.worker_id,
                title: r.title,
                body: r.body,
                data: r.data as Record<string, unknown>
            }))
        );

        // 3. Process Results
        const successIds: string[] = [];
        const failedIds: string[] = [];

        for (const [id, result] of results.entries()) {
            if (result.success) {
                successIds.push(id);
            } else {
                failedIds.push(id);
            }
        }

        // Bulk Update Success
        if (successIds.length > 0) {
            await db.update(scheduledNotification)
                .set({
                    status: 'sent',
                    sentAt: new Date(),
                    updatedAt: new Date()
                })
                .where(inArray(scheduledNotification.id, successIds));
        }

        // Bulk Update Failure
        if (failedIds.length > 0) {
            // We could implement retry logic here (check attempts < MAX_ATTEMPTS)
            // For now, mark failed.
            await db.update(scheduledNotification)
                .set({
                    status: 'failed',
                    // attempts: sql`attempts + 1`, // If we want to retry later
                    lastError: 'Batch send failed',
                    updatedAt: new Date()
                })
                .where(inArray(scheduledNotification.id, failedIds));
        }

        console.log(`[WORKER] Processed: ${successIds.length} sent, ${failedIds.length} failed`);

    } catch (error) {
        console.error('[WORKER] Error in polling loop:', error);
    }
}
