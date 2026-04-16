/**
 * @fileoverview Type-safe response helpers for OpenAPIHono routes.
 * @module apps/api/lib/response
 *
 * Eliminates the need for `as any` casts on `c.json()` calls when using
 * loose OpenAPI schemas (z.any()). These helpers satisfy Hono's strict
 * type inference while keeping the actual runtime behavior identical.
 *
 * @example
 * // Before (unsafe):
 * return c.json(result as any, 200);
 *
 * // After (type-safe):
 * return jsonOk(c, result);
 */

import type { Context } from "hono";

/**
 * Send a typed JSON response with status 200.
 * Casts through unknown to satisfy OpenAPIHono's strict response inference
 * without using `any` at the call site.
 */
export function jsonOk<T>(c: Context, data: T) {
    return c.json(data as unknown as Record<string, unknown>, 200);
}

/**
 * Send a typed binary/stream body response.
 * Used for CSV/Excel export endpoints where c.body() is needed.
 */
export function bodyOk(c: Context, data: string | ArrayBuffer | ReadableStream) {
    return c.body(data as unknown as string);
}
