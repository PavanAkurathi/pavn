import { db } from "./db.js";
import { auditLog } from "./schema.js";
import { nanoid } from "nanoid";

export interface AuditLogParams {
    action: string;
    entityType: string;
    entityId: string;
    actorId?: string | null;
    organizationId: string;
    metadata?: Record<string, any>;
}

export async function logAudit(params: AuditLogParams) {
    try {
        await db.insert(auditLog).values({
            id: nanoid(),
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId,
            actorId: params.actorId || null,
            organizationId: params.organizationId,
            metadata: params.metadata,
        });
    } catch (error) {
        // Audit logging should utilize "best effort" delivery. 
        // We don't want to fail the main transaction just because the log failed.
        // In a real production system, this would be a message queue.
        console.error("Failed to log audit event:", error);
    }
}
