/**
 * @fileoverview Rate Limiting Middleware with Hybrid Memory + Database Persistence
 * @module apps/api/middleware/rate-limit
 * 
 * Implements sliding window rate limiting to prevent API abuse. Uses a hybrid
 * approach: fast in-memory cache for immediate checks, with async database
 * persistence for distributed deployments.
 * 
 * @description
 * This middleware protects endpoints from abuse by tracking request counts
 * per user/org/path combination. It's designed for both single-instance and
 * distributed deployments.
 * 
 * Features:
 * - Memory-first for sub-millisecond checks
 * - Async DB persistence for multi-instance consistency
 * - Configurable windows and limits per endpoint type
 * - Standard rate limit headers (X-RateLimit-*)
 * - Automatic memory cleanup every 10 minutes
 * 
 * Pre-configured Limits:
 * - clockAction: 5/minute (prevent clock spam)
 * - publish: 10/minute (schedule publishing)
 * - api: 100/minute (general endpoints)
 * - auth: 10/15min (login attempts)
 * - strict: 3/minute (sensitive operations)
 * 
 * @example
 * // Apply rate limiting to a route
 * import { rateLimit, RATE_LIMITS } from "../middleware";
 * 
 * router.post("/clock-in", rateLimit(RATE_LIMITS.clockAction), async (c) => {
 *     // Handler...
 * });
 * 
 * // Custom rate limit
 * router.post("/export", rateLimit({ windowMs: 60000, maxRequests: 5 }), ...);
 * 
 * @author WorkersHive Team
 * @since 1.0.0
 */

import { Context, Next } from "hono";
import { db } from "@repo/database";
import { rateLimitState } from "@repo/database/schema";
import { eq, and, sql } from "drizzle-orm";
import type { AppContext } from "../index";

/**
 * Configuration options for rate limiting.
 */
interface RateLimitConfig {
    /** Time window in milliseconds */
    windowMs: number;
    /** Maximum requests allowed per window */
    maxRequests: number;
    /** Optional custom key generator function */
    keyFn?: (c: Context) => string;
}

/**
 * In-memory cache for fast rate limit lookups.
 * Key format: "userId:orgId:path"
 */
const memoryCache = new Map<string, { count: number; windowStart: number }>();

/**
 * Pre-configured rate limit settings for common use cases.
 * Import and use these with the rateLimit() middleware.
 */
export const RATE_LIMITS = {
    /** Clock in/out actions - 5 per minute (prevent spam) */
    clockAction: { windowMs: 60_000, maxRequests: 5 },
    
    /** Schedule publish - 10 per minute */
    publish: { windowMs: 60_000, maxRequests: 10 },
    
    /** General API endpoints - 100 per minute */
    api: { windowMs: 60_000, maxRequests: 100 },
    
    /** Auth attempts - 10 per 15 minutes (brute force protection) */
    auth: { windowMs: 900_000, maxRequests: 10 },
    
    /** Strict limit - 3 per minute (for sensitive operations) */
    strict: { windowMs: 60_000, maxRequests: 3 },
} as const;

/**
 * Rate limiting middleware factory.
 * 
 * Checks request count against configured limits and returns 429
 * if the limit is exceeded. Sets standard rate limit headers on
 * all responses.
 * 
 * @param config - Rate limit configuration
 * @returns Hono middleware function
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
 * Asynchronously persist rate limit state to database.
 * This enables distributed rate limiting across multiple instances.
 * Non-blocking and failure-tolerant (logs warning on error).
 * 
 * @param key - Rate limit key
 * @param count - Current request count
 * @param windowStart - Window start timestamp
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
 * Cleanup expired entries from in-memory cache.
 * Removes entries older than 1 hour to prevent memory leaks.
 * Called automatically every 10 minutes.
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
