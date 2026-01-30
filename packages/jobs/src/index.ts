// packages/jobs/src/index.ts

/**
 * WorkersHive Background Jobs
 * 
 * Uses Trigger.dev for serverless background job processing.
 * 
 * Jobs:
 * - sendScheduledNotifications: Process notification queue
 * - processTimesheetApproval: Auto-approve timesheets after 72hrs
 * - cleanupExpiredSessions: Remove old sessions
 * - syncStripeWebhooks: Handle failed webhook retries
 */

export * from "./jobs/notifications";
export * from "./jobs/timesheets";
export * from "./jobs/cleanup";
export * from "./jobs/disputes";
