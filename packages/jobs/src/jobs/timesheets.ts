// packages/jobs/src/jobs/timesheets.ts

import { task, schedules } from "@trigger.dev/sdk/v3";
import { db } from "@repo/database";
import { sql } from "drizzle-orm";

/**
 * Timesheet Auto-Approval Job
 * 
 * Runs daily at midnight to auto-approve timesheets that have been
 * in 'completed' status for more than 72 hours without issues.
 */
export const timesheetAutoApproval = schedules.task({
    id: "timesheet-auto-approval",
    cron: "0 0 * * *", // Midnight daily
    run: async () => {
        const now = new Date();
        const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
        
        // Find shifts completed > 72 hours ago that are not approved
        const autoApproved = await db.execute(sql`
            UPDATE shift
            SET 
                status = 'approved',
                approved_at = NOW(),
                approved_by = 'system',
                updated_at = NOW()
            WHERE status = 'completed'
                AND updated_at < ${seventyTwoHoursAgo}
                AND id NOT IN (
                    -- Exclude shifts with pending corrections
                    SELECT DISTINCT s.id 
                    FROM shift s
                    JOIN shift_assignment sa ON s.id = sa.shift_id
                    JOIN correction_request cr ON sa.id = cr.shift_assignment_id
                    WHERE cr.status IN ('pending', 'escalated')
                )
                AND id NOT IN (
                    -- Exclude shifts with flagged timesheets
                    SELECT DISTINCT shift_id 
                    FROM shift_assignment
                    WHERE is_flagged = true
                )
            RETURNING id, title, organization_id
        `);
        
        console.log(`[TIMESHEETS] Auto-approved ${autoApproved.rows?.length || 0} shifts`);
        
        return { autoApproved: autoApproved.rows?.length || 0 };
    },
});

/**
 * Timesheet Flagging Job
 * 
 * Runs every 15 minutes to flag timesheets with anomalies:
 * - Excessive hours (>12 per shift)
 * - Missing clock out
 * - GPS verification failures
 */
export const timesheetFlagging = schedules.task({
    id: "timesheet-flagging",
    cron: "*/15 * * * *",
    run: async () => {
        const now = new Date();
        const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);
        
        // Flag shifts that ended but have workers without clock-out
        const missingClockOut = await db.execute(sql`
            UPDATE shift_assignment
            SET 
                is_flagged = true,
                flag_reason = 'Missing clock out after shift end',
                updated_at = NOW()
            WHERE clock_in IS NOT NULL
                AND clock_out IS NULL
                AND shift_id IN (
                    SELECT id FROM shift
                    WHERE end_time < ${eightHoursAgo}
                    AND status NOT IN ('cancelled', 'draft')
                )
                AND is_flagged = false
            RETURNING id
        `);
        
        // Flag excessive hours (>12 hours)
        const excessiveHours = await db.execute(sql`
            UPDATE shift_assignment
            SET 
                is_flagged = true,
                flag_reason = 'Excessive hours: over 12 hours worked',
                updated_at = NOW()
            WHERE clock_in IS NOT NULL
                AND clock_out IS NOT NULL
                AND EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600 > 12
                AND is_flagged = false
            RETURNING id
        `);
        
        // Flag GPS mismatches
        const gpsMismatch = await db.execute(sql`
            UPDATE shift_assignment
            SET 
                is_flagged = true,
                flag_reason = 'GPS verification failed or outside geofence',
                updated_at = NOW()
            WHERE (clock_in_verified = false OR clock_out_verified = false)
                AND clock_in IS NOT NULL
                AND is_flagged = false
            RETURNING id
        `);
        
        const totalFlagged = 
            (missingClockOut.rows?.length || 0) + 
            (excessiveHours.rows?.length || 0) + 
            (gpsMismatch.rows?.length || 0);
        
        console.log(`[TIMESHEETS] Flagged ${totalFlagged} assignments`);
        
        return {
            missingClockOut: missingClockOut.rows?.length || 0,
            excessiveHours: excessiveHours.rows?.length || 0,
            gpsMismatch: gpsMismatch.rows?.length || 0,
        };
    },
});

/**
 * Weekly Payroll Summary Job
 * 
 * Runs every Monday at 6 AM to generate weekly payroll summary
 * for all organizations.
 */
export const weeklyPayrollSummary = schedules.task({
    id: "weekly-payroll-summary",
    cron: "0 6 * * 1", // Monday at 6 AM
    run: async () => {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        // Get payroll summary per organization
        const summaries = await db.execute(sql`
            SELECT 
                s.organization_id,
                o.name as org_name,
                COUNT(DISTINCT sa.worker_id) as worker_count,
                COUNT(DISTINCT s.id) as shift_count,
                SUM(
                    EXTRACT(EPOCH FROM (COALESCE(sa.clock_out, s.end_time) - sa.clock_in)) / 3600
                ) as total_hours,
                SUM(
                    (EXTRACT(EPOCH FROM (COALESCE(sa.clock_out, s.end_time) - sa.clock_in)) / 3600) 
                    * COALESCE(sa.hourly_rate, 0)
                ) as total_pay
            FROM shift s
            JOIN shift_assignment sa ON s.id = sa.shift_id
            JOIN organization o ON s.organization_id = o.id
            WHERE s.status = 'approved'
                AND s.approved_at >= ${oneWeekAgo}
                AND sa.clock_in IS NOT NULL
            GROUP BY s.organization_id, o.name
        `);
        
        console.log(`[PAYROLL] Generated ${summaries.rows?.length || 0} weekly summaries`);
        
        // TODO: Send email summaries to org admins
        // TODO: Store summaries in payroll_report table
        
        return { summaries: summaries.rows?.length || 0 };
    },
});
