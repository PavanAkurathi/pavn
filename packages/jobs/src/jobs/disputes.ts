// packages/jobs/src/jobs/disputes.ts

import { task, schedules } from "@trigger.dev/sdk/v3";
import { db } from "@repo/database";
import { sql } from "drizzle-orm";

/**
 * Dispute Auto-Escalation Job
 * 
 * Runs every hour to auto-escalate disputes that haven't been reviewed
 * within 72 hours.
 * 
 * Workflow:
 * 1. Worker submits correction request (status: pending)
 * 2. Manager has 72 hours to review
 * 3. If not reviewed, auto-escalate to admin
 * 4. If admin doesn't review in 48hrs, auto-approve
 */
export const disputeAutoEscalation = schedules.task({
    id: "dispute-auto-escalation",
    cron: "0 * * * *", // Every hour
    run: async () => {
        const now = new Date();
        const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
        const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        
        // Find pending corrections that are > 72 hours old (escalate to admin)
        const pendingEscalations = await db.execute(sql`
            UPDATE correction_request
            SET 
                status = 'escalated',
                escalated_at = NOW(),
                escalation_reason = '72-hour auto-escalation: Manager did not review',
                updated_at = NOW()
            WHERE status = 'pending'
                AND created_at < ${seventyTwoHoursAgo}
                AND escalated_at IS NULL
            RETURNING id, shift_assignment_id, organization_id, reason
        `);
        
        console.log(`[DISPUTES] Escalated ${pendingEscalations.rows?.length || 0} corrections`);
        
        // Find escalated corrections that are > 48 hours since escalation (auto-approve)
        const autoApprovals = await db.execute(sql`
            UPDATE correction_request
            SET 
                status = 'approved',
                reviewed_by = 'system',
                reviewed_at = NOW(),
                review_notes = '48-hour auto-approval: Admin did not review after escalation',
                updated_at = NOW()
            WHERE status = 'escalated'
                AND escalated_at < ${fortyEightHoursAgo}
            RETURNING id, shift_assignment_id, requested_clock_in, requested_clock_out
        `);
        
        console.log(`[DISPUTES] Auto-approved ${autoApprovals.rows?.length || 0} corrections`);
        
        // Apply approved corrections to timesheets
        for (const correction of (autoApprovals.rows || [])) {
            try {
                await db.execute(sql`
                    UPDATE shift_assignment
                    SET 
                        clock_in = COALESCE(${correction.requested_clock_in}, clock_in),
                        clock_out = COALESCE(${correction.requested_clock_out}, clock_out),
                        clock_in_method = 'correction',
                        clock_out_method = 'correction',
                        updated_at = NOW()
                    WHERE id = ${correction.shift_assignment_id}
                `);
            } catch (error) {
                console.error(`[DISPUTES] Failed to apply correction ${correction.id}:`, error);
            }
        }
        
        return {
            escalated: pendingEscalations.rows?.length || 0,
            autoApproved: autoApprovals.rows?.length || 0,
        };
    },
});

/**
 * Dispute Reminder Job
 * 
 * Runs daily to remind managers about pending corrections
 * that are approaching the 72-hour escalation deadline.
 */
export const disputeReminder = schedules.task({
    id: "dispute-reminder",
    cron: "0 9 * * *", // 9 AM daily
    run: async () => {
        const now = new Date();
        const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
        
        // Find corrections that are 48-72 hours old (approaching deadline)
        const approachingDeadline = await db.execute(sql`
            SELECT 
                cr.id,
                cr.organization_id,
                cr.reason,
                cr.created_at,
                u.name as worker_name,
                s.title as shift_title
            FROM correction_request cr
            JOIN shift_assignment sa ON cr.shift_assignment_id = sa.id
            JOIN "user" u ON sa.worker_id = u.id
            JOIN shift s ON sa.shift_id = s.id
            WHERE cr.status = 'pending'
                AND cr.created_at < ${fortyEightHoursAgo}
                AND cr.created_at > ${seventyTwoHoursAgo}
        `);
        
        console.log(`[DISPUTES] ${approachingDeadline.rows?.length || 0} corrections approaching deadline`);
        
        // Group by organization and send digest
        const byOrg: Record<string, any[]> = {};
        for (const row of (approachingDeadline.rows || [])) {
            if (!byOrg[row.organization_id]) {
                byOrg[row.organization_id] = [];
            }
            byOrg[row.organization_id].push(row);
        }
        
        // TODO: Send email digest to org managers
        // for (const [orgId, corrections] of Object.entries(byOrg)) {
        //     await sendManagerDigest(orgId, corrections);
        // }
        
        return { reminders: approachingDeadline.rows?.length || 0 };
    },
});
