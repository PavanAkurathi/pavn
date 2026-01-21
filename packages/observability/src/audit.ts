
import { db } from "@repo/database";
import { auditLog } from "@repo/database/schema";
import { nanoid } from "nanoid";

interface AuditEntry {
    organizationId?: string;
    entityType: string;
    entityId: string;
    action: string;
    userId?: string; // actorId
    userName?: string;
    changes?: {
        before: Record<string, any>;
        after: Record<string, any>;
    };
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
    try {
        if (!entry.organizationId) {
            console.warn('[AUDIT] Missing organizationId, skipping log.');
            return;
        }

        await db.insert(auditLog).values({
            id: nanoid(),
            organizationId: entry.organizationId,
            entityType: entry.entityType,
            entityId: entry.entityId,
            action: entry.action,
            actorId: entry.userId,
            userName: entry.userName,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
            changes: entry.changes,
            metadata: entry.metadata,
            createdAt: new Date(),
        });
    } catch (error) {
        // Don't fail the request if audit logging fails
        console.error('[AUDIT] Failed to log:', error);
    }
}

// Helper for shift changes
export async function logShiftChange(
    shiftId: string,
    orgId: string,
    action: string,
    userId: string, // actor
    userName: string,
    before: any,
    after: any
): Promise<void> {
    await logAudit({
        organizationId: orgId,
        entityType: 'shift',
        entityId: shiftId,
        action,
        userId,
        userName,
        changes: { before, after },
    });
}
