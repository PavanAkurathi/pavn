// packages/shifts/src/middleware/rbac.ts

import { Context, Next } from "hono";
import { db } from "@repo/database";
import { member } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";

/**
 * Role Types:
 * - admin: Full access including payment method CRUD
 * - manager: Full access EXCEPT payment method CRUD
 * - member: Worker-level access (view own shifts, clock in/out)
 */
export type Role = "admin" | "manager" | "member";

/**
 * Permission definitions
 * Admin can do everything
 * Manager can do everything EXCEPT payment operations
 */
const ROLE_PERMISSIONS: Record<Role, string[]> = {
    admin: [
        "shifts:read",
        "shifts:write",
        "shifts:approve",
        "shifts:cancel",
        "timesheets:read",
        "timesheets:write",
        "timesheets:export",
        "crew:read",
        "crew:write",
        "locations:read",
        "locations:write",
        "adjustments:read",
        "adjustments:review",
        "schedules:publish",
        "payment:read",
        "payment:write",  // Only admin can CRUD payment methods
        "settings:read",
        "settings:write",
    ],
    manager: [
        "shifts:read",
        "shifts:write",
        "shifts:approve",
        "shifts:cancel",
        "timesheets:read",
        "timesheets:write",
        "timesheets:export",
        "crew:read",
        "crew:write",
        "locations:read",
        "locations:write",
        "adjustments:read",
        "adjustments:review",
        "schedules:publish",
        "payment:read",     // Manager can READ payment info
        // NO payment:write - Managers cannot CRUD payment methods
        "settings:read",
    ],
    member: [
        "shifts:read:own",
        "timesheets:read:own",
        "adjustments:create",
        "profile:read",
        "profile:write",
    ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: string): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];
    
    // Check exact match
    if (permissions.includes(permission)) {
        return true;
    }
    
    // Check if has full permission when requesting :own variant
    // e.g., if has "shifts:read", also has "shifts:read:own"
    const basePermission = permission.replace(":own", "");
    if (permission.endsWith(":own") && permissions.includes(basePermission)) {
        return true;
    }
    
    return false;
}

/**
 * Middleware factory to require specific permissions
 * 
 * Usage:
 *   app.post("/adjustments/review", requirePermission("adjustments:review"), handler)
 *   app.post("/payment/update", requirePermission("payment:write"), handler)
 */
export function requirePermission(...requiredPermissions: string[]) {
    return async (c: Context, next: Next) => {
        const userRole = c.get("userRole") as Role | undefined;
        
        if (!userRole) {
            return c.json({ error: "Role not determined" }, 403);
        }
        
        // Check if user has ALL required permissions
        const hasAll = requiredPermissions.every(perm => hasPermission(userRole, perm));
        
        if (!hasAll) {
            return c.json({ 
                error: "Insufficient permissions",
                required: requiredPermissions,
                role: userRole 
            }, 403);
        }
        
        await next();
    };
}

/**
 * Middleware factory to require specific roles
 * 
 * Usage:
 *   app.post("/settings/billing", requireRole("admin"), handler)
 */
export function requireRole(...allowedRoles: Role[]) {
    return async (c: Context, next: Next) => {
        const userRole = c.get("userRole") as Role | undefined;
        
        if (!userRole) {
            return c.json({ error: "Role not determined" }, 403);
        }
        
        if (!allowedRoles.includes(userRole)) {
            return c.json({ 
                error: "Access denied",
                message: `This action requires one of: ${allowedRoles.join(", ")}`,
                yourRole: userRole 
            }, 403);
        }
        
        await next();
    };
}

/**
 * Middleware to check if user is at least a manager (admin or manager)
 */
export function requireManager() {
    return requireRole("admin", "manager");
}

/**
 * Middleware to check if user is admin
 */
export function requireAdmin() {
    return requireRole("admin");
}

/**
 * Fetch user's role in an organization
 * Returns the role or null if not a member
 */
export async function getUserRole(userId: string, orgId: string): Promise<Role | null> {
    const memberRecord = await db.query.member.findFirst({
        where: and(
            eq(member.organizationId, orgId),
            eq(member.userId, userId)
        ),
        columns: { role: true }
    });
    
    if (!memberRecord) {
        return null;
    }
    
    // Map database role to our Role type
    // Database might have "admin", "manager", or "member"
    const role = memberRecord.role as Role;
    
    // Validate it's a known role
    if (!["admin", "manager", "member"].includes(role)) {
        console.warn(`Unknown role "${role}" for user ${userId} in org ${orgId}`);
        return "member"; // Default to lowest permission
    }
    
    return role;
}
