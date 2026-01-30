// packages/jobs/src/jobs/cleanup.ts

import { task, schedules } from "@trigger.dev/sdk/v3";
import { db } from "@repo/database";
import { sql } from "drizzle-orm";

/**
 * Session Cleanup Job
 * 
 * Runs daily to remove expired sessions from the database.
 */
export const sessionCleanup = schedules.task({
    id: "session-cleanup",
    cron: "0 3 * * *", // 3 AM daily
    run: async () => {
        const now = new Date();
        
        // Delete expired sessions
        const deleted = await db.execute(sql`
            DELETE FROM session
            WHERE expires_at < ${now}
            RETURNING id
        `);
        
        console.log(`[CLEANUP] Deleted ${deleted.rows?.length || 0} expired sessions`);
        
        return { deletedSessions: deleted.rows?.length || 0 };
    },
});

/**
 * Rate Limit Cleanup Job
 * 
 * Runs hourly to clear old rate limit entries.
 */
export const rateLimitCleanup = schedules.task({
    id: "rate-limit-cleanup",
    cron: "0 * * * *", // Every hour
    run: async () => {
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        
        const deleted = await db.execute(sql`
            DELETE FROM rate_limit_state
            WHERE window_start::bigint < ${twentyFourHoursAgo}
            RETURNING key
        `);
        
        console.log(`[CLEANUP] Deleted ${deleted.rows?.length || 0} rate limit entries`);
        
        return { deletedRateLimits: deleted.rows?.length || 0 };
    },
});

/**
 * Audit Log Cleanup Job
 * 
 * Runs weekly to archive/delete old audit logs (>90 days).
 */
export const auditLogCleanup = schedules.task({
    id: "audit-log-cleanup",
    cron: "0 4 * * 0", // Sunday at 4 AM
    run: async () => {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        
        // Count before deletion
        const countResult = await db.execute(sql`
            SELECT COUNT(*) as count FROM audit_log
            WHERE created_at < ${ninetyDaysAgo}
        `);
        
        const count = (countResult.rows?.[0] as any)?.count || 0;
        
        if (count > 0) {
            // Archive to cold storage (S3) before deletion
            // TODO: Implement S3 archival
            
            // For now, just delete
            await db.execute(sql`
                DELETE FROM audit_log
                WHERE created_at < ${ninetyDaysAgo}
            `);
            
            console.log(`[CLEANUP] Deleted ${count} old audit log entries`);
        }
        
        return { deletedAuditLogs: count };
    },
});

/**
 * Worker Location Cleanup Job
 * 
 * Runs daily to remove old location tracking data (>30 days).
 * Keeps only aggregate data for compliance.
 */
export const locationCleanup = schedules.task({
    id: "location-cleanup",
    cron: "0 2 * * *", // 2 AM daily
    run: async () => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        // Delete detailed location data but keep clock in/out positions
        // (Those are stored on shift_assignment, not worker_location)
        const deleted = await db.execute(sql`
            DELETE FROM worker_location
            WHERE recorded_at < ${thirtyDaysAgo}
                AND event_type NOT IN ('clock_in', 'clock_out')
            RETURNING id
        `);
        
        console.log(`[CLEANUP] Deleted ${deleted.rows?.length || 0} location records`);
        
        return { deletedLocations: deleted.rows?.length || 0 };
    },
});

/**
 * Notification Cleanup Job
 * 
 * Runs daily to remove old notifications (sent/failed > 7 days).
 */
export const notificationCleanup = schedules.task({
    id: "notification-cleanup",
    cron: "0 5 * * *", // 5 AM daily
    run: async () => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const deleted = await db.execute(sql`
            DELETE FROM scheduled_notification
            WHERE status IN ('sent', 'failed', 'cancelled')
                AND updated_at < ${sevenDaysAgo}
            RETURNING id
        `);
        
        console.log(`[CLEANUP] Deleted ${deleted.rows?.length || 0} old notifications`);
        
        return { deletedNotifications: deleted.rows?.length || 0 };
    },
});

/**
 * Stale Draft Cleanup Job
 * 
 * Runs weekly to remove draft shifts older than 30 days.
 */
export const staleDraftCleanup = schedules.task({
    id: "stale-draft-cleanup",
    cron: "0 6 * * 1", // Monday at 6 AM
    run: async () => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const deleted = await db.execute(sql`
            DELETE FROM shift
            WHERE status = 'draft'
                AND created_at < ${thirtyDaysAgo}
            RETURNING id, title, organization_id
        `);
        
        console.log(`[CLEANUP] Deleted ${deleted.rows?.length || 0} stale draft shifts`);
        
        return { deletedDrafts: deleted.rows?.length || 0 };
    },
});
