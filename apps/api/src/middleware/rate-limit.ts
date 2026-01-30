// apps/api/src/middleware/rate-limit.ts
// Rate Limiting Middleware with Memory + DB persistence

import { Context, Next } from "hono";
import { db } from "@repo/database";
import { rateLimitState } from "@repo/database/schema";
import { eq, and, sql } from "drizzle-orm";
import type { AppContext } from "../index";

interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window
    keyFn?: (c: Context) => string; // Custom key generator
}

// In-memory cache for fast lookups
const memoryCache = new Map<string, { count: number; windowStart: number }>();

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
    // Clock in/out - 5 per minute (prevent spam)
    clockAction: { windowMs: 60_000, maxRequests: 5 },
    
    // Schedule publish - 10 per minute
    publish: { windowMs: 60_000, maxRequests: 10 },
    
    // General API - 100 per minute
    api: { windowMs: 60_000, maxRequests: 100 },
    
    // Auth attempts - 10 per 15 minutes
    auth: { windowMs: 900_000, maxRequests: 10 },
    
    // Strict - 3 per minute (for sensitive operations)
    strict: { windowMs: 60_000, maxRequests: 3 },
} as const;

/**
 * Rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
    return async (c: Context<AppContext>, next: Next) => {
        const userId = c.get("user")?.id;
        const orgId = c.get("orgId");
        const path = c.req.path;
        
        // Generate rate limit key
        const key = config.keyFn?.(c) || `${userId || "anon"}:${orgId || "global"}:${path}`;
        const now = Date.now();
        
        // Check memory cache first (fast path)
        let cached = memoryCache.get(key);
        
        if (!cached || now - cached.windowStart >= config.windowMs) {
            // Window expired or not in cache, start fresh
            cached = { count: 0, windowStart: now };
        }
        
        cached.count++;
        memoryCache.set(key, cached);
        
        // Check if over limit
        if (cached.count > config.maxRequests) {
            const retryAfter = Math.ceil((cached.windowStart + config.windowMs - now) / 1000);
            
            c.res.headers.set("X-RateLimit-Limit", String(config.maxRequests));
            c.res.headers.set("X-RateLimit-Remaining", "0");
            c.res.headers.set("X-RateLimit-Reset", String(Math.ceil((cached.windowStart + config.windowMs) / 1000)));
            c.res.headers.set("Retry-After", String(retryAfter));
            
            return c.json({
                error: "Too many requests",
                code: "RATE_LIMITED",
                retryAfter,
            }, 429);
        }
        
        // Set rate limit headers
        c.res.headers.set("X-RateLimit-Limit", String(config.maxRequests));
        c.res.headers.set("X-RateLimit-Remaining", String(config.maxRequests - cached.count));
        c.res.headers.set("X-RateLimit-Reset", String(Math.ceil((cached.windowStart + config.windowMs) / 1000)));
        
        // Persist to DB asynchronously (for distributed rate limiting)
        persistRateLimitAsync(key, cached.count, cached.windowStart).catch(console.error);
        
        await next();
    };
}

/**
 * Async DB persistence for distributed environments
 */
async function persistRateLimitAsync(key: string, count: number, windowStart: number) {
    try {
        await db.insert(rateLimitState)
            .values({
                key,
                count,
                windowStart: String(windowStart),
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: rateLimitState.key,
                set: {
                    count,
                    windowStart: String(windowStart),
                    updatedAt: new Date(),
                },
            });
    } catch (error) {
        // Non-critical, just log
        console.warn("[RATE_LIMIT] Failed to persist:", error);
    }
}

/**
 * Cleanup expired entries from memory cache
 */
export function cleanupRateLimitCache() {
    const now = Date.now();
    const maxAge = 3600_000; // 1 hour
    
    for (const [key, value] of memoryCache.entries()) {
        if (now - value.windowStart > maxAge) {
            memoryCache.delete(key);
        }
    }
}

// Run cleanup every 10 minutes
setInterval(cleanupRateLimitCache, 600_000);
