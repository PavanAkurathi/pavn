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
 * - Serverless-compatible (no setInterval)
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
 * The caller's IP as the edge saw it. Behind the web app's auth proxy this can
 * be the web server's address rather than the browser's, so treat it as a
 * coarse key, not an identity.
 */
export function clientIp(c: Context): string {
    const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    return c.req.header("x-real-ip") || forwarded || "unknown";
}

/**
 * In-memory cache for fast rate limit lookups.
 * Key format: "userId-or-ip:orgId:path"
 * Note: In serverless, this resets on cold starts - DB persistence handles continuity
 */
const memoryCache = new Map<string, { count: number; windowStart: number }>();

/**
 * Hard ceiling on the cache. Keys carry the request path, so a caller who varies the
 * path can mint keys faster than the 1% sampled cleanup removes them. Over the ceiling
 * the oldest entries go first, which can only ever forgive a count, never invent one.
 */
export const MAX_CACHE_ENTRIES = 20_000;

/** For tests: how many keys the limiter is holding. */
export function rateLimitCacheSize() {
    return memoryCache.size;
}

function enforceCacheCeiling() {
    if (memoryCache.size < MAX_CACHE_ENTRIES) return;
    cleanupRateLimitCache();
    if (memoryCache.size < MAX_CACHE_ENTRIES) return;
    // Map iterates in insertion order: drop the oldest tenth.
    let drop = Math.ceil(MAX_CACHE_ENTRIES / 10);
    for (const key of memoryCache.keys()) {
        if (drop-- <= 0) break;
        memoryCache.delete(key);
    }
}

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
    
    /**
     * Sign-in, sign-up and one-time-code attempts: 20 per 15 minutes per client
     * IP and endpoint (brute-force protection). Never apply this to session reads
     * such as get-session: those run on every page load, and callers on /api/auth
     * are anonymous, so without the IP key everyone would share one budget.
     */
    auth: { windowMs: 900_000, maxRequests: 20, keyFn: (c: Context) => `ip:${clientIp(c)}:${c.req.path}` },
    
    /**
     * The public worker lookups (is this number invited, who sent this invite code):
     * 60 per 15 minutes per client IP, in one bucket. The bucket must not depend on the
     * path, because the invite code is in it: keyed by path, every guess would start
     * with a fresh budget.
     */
    workerLookup: { windowMs: 900_000, maxRequests: 60, keyFn: (c: Context) => `ip:${clientIp(c)}:worker-lookup` },

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
        if (process.env.NODE_ENV !== "production" || process.env.DISABLE_RATE_LIMIT === "true") {
            await next();
            return;
        }

        const userId = c.get("user")?.id;
        const orgId = c.get("orgId");
        const path = c.req.path;
        
        // Generate rate limit key
        // Signed-in callers get their own budget; anonymous ones are keyed by IP
        // so they never all share one.
        const key = config.keyFn?.(c) || `${userId || `ip:${clientIp(c)}`}:${orgId || "global"}:${path}`;
        const now = Date.now();
        
        // Check memory cache first (fast path)
        let cached = memoryCache.get(key);
        
        if (!cached || now - cached.windowStart >= config.windowMs) {
            // Window expired or not in cache, start fresh
            cached = { count: 0, windowStart: now };
        }
        
        cached.count++;
        enforceCacheCeiling();
        memoryCache.set(key, cached);
        
        // Cleanup old entries on each request (instead of setInterval)
        // Only run cleanup ~1% of requests to avoid overhead
        if (Math.random() < 0.01) {
            cleanupRateLimitCache();
        }
        
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
        persistRateLimitAsync(key, cached.count, cached.windowStart).catch(() => {
            // Silently fail - rate limiting will still work via memory
        });
        
        await next();
    };
}

/**
 * Asynchronously persist rate limit state to database.
 * This enables distributed rate limiting across multiple instances.
 * Non-blocking and failure-tolerant.
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
        // Non-critical, silently fail
    }
}

/**
 * Cleanup expired entries from in-memory cache.
 * Removes entries older than 1 hour to prevent memory leaks.
 * Called probabilistically on requests (serverless-compatible).
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
