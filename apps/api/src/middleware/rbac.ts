// apps/api/src/middleware/rbac.ts
// Role-Based Access Control Middleware

import { Context, Next } from "hono";
import type { AppContext } from "../index";

export type Role = "owner" | "admin" | "manager" | "member";

// Permission definitions
const ROLE_PERMISSIONS: Record<Role, string[]> = {
    owner: ["*"], // Full access
    admin: [
        "shifts:read", "shifts:write",
        "timesheets:read", "timesheets:write",
        "crew:read", "crew:write",
        "billing:read", "billing:write",
        "payment:read", "payment:write",
        "settings:read", "settings:write",
        "adjustments:read", "adjustments:review",
    ],
    manager: [
        "shifts:read", "shifts:write",
        "timesheets:read", "timesheets:write",
        "crew:read", "crew:write",
        "billing:read", // Can view, not edit
        "payment:read", // Can view, NOT write
        "settings:read",
        "adjustments:read", "adjustments:review",
    ],
    member: [
        "shifts:read:own",
        "timesheets:read:own",
        "adjustments:create",
        "profile:read", "profile:write",
    ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role | null, permission: string): boolean {
    if (!role) return false;
    const permissions = ROLE_PERMISSIONS[role] || [];
    
    // Owner has all permissions
    if (permissions.includes("*")) return true;
    
    // Check exact permission
    if (permissions.includes(permission)) return true;
    
    // Check wildcard (e.g., "shifts:read" covers "shifts:read:own")
    const [resource, action] = permission.split(":");
    if (permissions.includes(`${resource}:${action}`)) return true;
    
    return false;
}

/**
 * Middleware: Require specific permission(s)
 */
export function requirePermission(...permissions: string[]) {
    return async (c: Context<AppContext>, next: Next) => {
        const role = c.get("userRole");
        
        for (const permission of permissions) {
            if (!hasPermission(role, permission)) {
                return c.json({
                    error: "Forbidden",
                    code: "INSUFFICIENT_PERMISSIONS",
                    required: permissions,
                }, 403);
            }
        }
        
        await next();
    };
}

/**
 * Middleware: Require manager or above (manager, admin, owner)
 */
export function requireManager() {
    return async (c: Context<AppContext>, next: Next) => {
        const role = c.get("userRole");
        
        if (!role || !["owner", "admin", "manager"].includes(role)) {
            return c.json({
                error: "Forbidden",
                code: "MANAGER_REQUIRED",
                message: "This action requires manager privileges",
            }, 403);
        }
        
        await next();
    };
}

/**
 * Middleware: Require admin or above (admin, owner)
 */
export function requireAdmin() {
    return async (c: Context<AppContext>, next: Next) => {
        const role = c.get("userRole");
        
        if (!role || !["owner", "admin"].includes(role)) {
            return c.json({
                error: "Forbidden",
                code: "ADMIN_REQUIRED",
                message: "This action requires admin privileges",
            }, 403);
        }
        
        await next();
    };
}

/**
 * Middleware: Require owner only
 */
export function requireOwner() {
    return async (c: Context<AppContext>, next: Next) => {
        const role = c.get("userRole");
        
        if (role !== "owner") {
            return c.json({
                error: "Forbidden",
                code: "OWNER_REQUIRED",
                message: "This action requires owner privileges",
            }, 403);
        }
        
        await next();
    };
}
