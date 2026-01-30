/**
 * @fileoverview Role-Based Access Control (RBAC) Middleware
 * @module apps/api/middleware/rbac
 * 
 * Provides middleware functions for enforcing role-based permissions
 * across API routes. Implements a hierarchical permission system with
 * four roles: owner > admin > manager > member.
 * 
 * @description
 * This module defines the permission matrix for WorkersHive and provides
 * reusable middleware functions that can be applied to routes to enforce
 * access control based on the authenticated user's role.
 * 
 * Role Hierarchy:
 * - owner: Full access to all resources and settings
 * - admin: Full operational access, billing/payment management
 * - manager: Shift/crew management, timesheet approval, no payment access
 * - member: Own data only (shifts, timesheets, profile)
 * 
 * Permission Format: "resource:action" or "resource:action:scope"
 * Examples: "shifts:read", "timesheets:write", "shifts:read:own"
 * 
 * @example
 * // Protect a route - require manager or above
 * router.get("/shifts", requireManager(), async (c) => { ... });
 * 
 * // Require specific permission
 * router.delete("/user", requirePermission("users:delete"), async (c) => { ... });
 * 
 * // Admin-only route
 * router.post("/billing", requireAdmin(), async (c) => { ... });
 * 
 * @author WorkersHive Team
 * @since 1.0.0
 */

import { Context, Next } from "hono";
import type { AppContext } from "../index";

export type Role = "owner" | "admin" | "manager" | "member";

/**
 * Permission definitions for each role.
 * Owner has wildcard (*) access to everything.
 * Other roles have explicit permission lists.
 */
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
 * Check if a role has a specific permission.
 * Supports wildcard matching and hierarchical permissions.
 * 
 * @param role - The user's role
 * @param permission - The permission to check (e.g., "shifts:read")
 * @returns True if the role has the permission
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
 * Middleware factory: Require specific permission(s) to access route.
 * Returns 403 Forbidden if any required permission is missing.
 * 
 * @param permissions - One or more permissions required
 * @returns Hono middleware function
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
 * Middleware: Require manager role or above (manager, admin, owner).
 * Use for shift management, crew management, timesheet approval.
 * 
 * @returns Hono middleware function
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
 * Middleware: Require admin role or above (admin, owner).
 * Use for billing, payment methods, organization settings.
 * 
 * @returns Hono middleware function
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
 * Middleware: Require owner role only.
 * Use for destructive operations, ownership transfer, org deletion.
 * 
 * @returns Hono middleware function
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
