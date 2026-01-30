// packages/shifts/src/middleware/rate-limit.ts

import { Context, Next } from "hono";
import { db } from "@repo/database";
import { rateLimitState } from "@repo/database/schema";
import { eq, sql } from "drizzle-orm";

interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window
    keyPrefix: string;     // Prefix for the rate limit key
    keyFn?: (c: Context) => string; // Custom key generator
}

/**
 * Default rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
    // Clock in/out - prevent abuse
    clockAction: {
        windowMs: 60 * 1000,  // 1 minute
        maxRequests: 5,        // 5 requests per minute
        keyPrefix: "clock",
    },
    // Schedule publishing - prevent spam
    publish: {
        windowMs: 60 * 1000,  // 1 minute
        maxRequests: 10,       // 10 publishes per minute
        keyPrefix: "publish",
    },
    // API general - standard protection
    api: {
        windowMs: 60 * 1000,  // 1 minute
        maxRequests: 100,      // 100 requests per minute
        keyPrefix: "api",
    },
    // Auth endpoints - prevent brute force
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 10,           // 10 attempts per 15 min
        keyPrefix: "auth",
    },
} as const;

/**
 * In-memory rate limiter for fast checks
 * Falls back to DB for distributed environments
 */
const memoryStore = new Map<string, { count: number; windowStart: number }>();

/**
 * Rate limiting middleware factory
 * 
 * Usage:
 *   app.post("/clock-in", rateLimit(RATE_LIMITS.clockAction), handler)
 */
export function rateLimit(config: RateLimitConfig) {
    return async (c: Context, next: Next) => {
        const userId = c.get("user")?.id;
        const orgId = c.get("orgId");
        
        // Generate unique key
        let key: string;
        if (config.keyFn) {
            key = config.keyFn(c);
        } else {
            // Default key: prefix:orgId:userId or prefix:ip
            const identifier = userId || c.req.header("x-forwarded-for") || "anonymous";
            key = `${config.keyPrefix}:${orgId || "global"}:${identifier}`;
        }
        
        const now = Date.now();
        
        // Check memory store first (faster)
        const memEntry = memoryStore.get(key);
        
        if (memEntry) {
            // Check if window expired
            if (now - memEntry.windowStart > config.windowMs) {
                // Reset window
                memEntry.count = 1;
                memEntry.windowStart = now;
            } else if (memEntry.count >= config.maxRequests) {
                // Rate limited
                const retryAfter = Math.ceil((memEntry.windowStart + config.windowMs - now) / 1000);
                
                c.header("X-RateLimit-Limit", String(config.maxRequests));
                c.header("X-RateLimit-Remaining", "0");
                c.header("X-RateLimit-Reset", String(Math.ceil((memEntry.windowStart + config.windowMs) / 1000)));
                c.header("Retry-After", String(retryAfter));
                
                return c.json({
                    error: "Rate limit exceeded",
                    code: "RATE_LIMITED",
                    retryAfter,
                    limit: config.maxRequests,
                    windowMs: config.windowMs,
                }, 429);
            } else {
                memEntry.count++;
            }
        } else {
            // New entry
            memoryStore.set(key, { count: 1, windowStart: now });
        }
        
        // Also persist to DB for distributed rate limiting (async, non-blocking)
        persistRateLimitState(key, config).catch(err => {
            console.error("[RATE_LIMIT] DB persist error:", err);
        });
        
        // Set rate limit headers
        const entry = memoryStore.get(key)!;
        c.header("X-RateLimit-Limit", String(config.maxRequests));
        c.header("X-RateLimit-Remaining", String(Math.max(0, config.maxRequests - entry.count)));
        c.header("X-RateLimit-Reset", String(Math.ceil((entry.windowStart + config.windowMs) / 1000)));
        
        await next();
    };
}

/**
 * Persist rate limit state to database
 * This enables distributed rate limiting across multiple instances
 */
async function persistRateLimitState(key: string, config: RateLimitConfig) {
    const now = Date.now();
    
    try {
        // Upsert rate limit state
        await db
            .insert(rateLimitState)
            .values({
                key,
                count: 1,
                windowStart: String(now),
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: rateLimitState.key,
                set: {
                    count: sql`
                        CASE 
                            WHEN ${rateLimitState.windowStart}::bigint + ${config.windowMs} < ${now}::bigint 
                            THEN 1
                            ELSE ${rateLimitState.count} + 1
                        END
                    `,
                    windowStart: sql`
                        CASE 
                            WHEN ${rateLimitState.windowStart}::bigint + ${config.windowMs} < ${now}::bigint 
                            THEN ${String(now)}
                            ELSE ${rateLimitState.windowStart}
                        END
                    `,
                    updatedAt: new Date(),
                },
            });
    } catch (error) {
        // Non-critical, log and continue
        console.error("[RATE_LIMIT] Persist error:", error);
    }
}

/**
 * Cleanup expired rate limit entries (call periodically)
 */
export async function cleanupExpiredRateLimits(maxAgeMs: number = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    
    // Clean memory store
    for (const [key, entry] of memoryStore.entries()) {
        if (entry.windowStart < cutoff) {
            memoryStore.delete(key);
        }
    }
    
    // Clean DB store
    try {
        await db.delete(rateLimitState)
            .where(sql`${rateLimitState.windowStart}::bigint < ${cutoff}`);
    } catch (error) {
        console.error("[RATE_LIMIT] Cleanup error:", error);
    }
}

/**
 * Reset rate limit for a specific key (useful for testing or admin override)
 */
export function resetRateLimit(key: string) {
    memoryStore.delete(key);
}
