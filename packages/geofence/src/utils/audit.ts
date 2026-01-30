import { db } from "@repo/database";
import { auditLog } from "@repo/database/schema";
import { nanoid } from "nanoid";

export type AuditAction =
    | "CLOCK_IN"
    | "CLOCK_OUT"
    | "GEOFENCE_ENTER"
    | "GEOFENCE_EXIT"
    | "LOCATION_UPDATE"
    | "MANAGER_OVERRIDE";

export async function logAudit(
    organizationId: string,
    action: AuditAction,
    entityType: string,
    entityId: string,
    metadata: Record<string, any> = {},
    actorId?: string
) {
    try {
        await db.insert(auditLog).values({
            id: nanoid(),
            organizationId,
            entityType,
            entityId,
            action,
            actorId,
            metadata
        });
        console.log(`[AUDIT] ${action}`, { organizationId, entityType, entityId, metadata });
    } catch (error) {
        console.error(`[AUDIT_ERROR] Failed to log audit:`, error);
    }
}
