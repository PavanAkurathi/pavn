// Basic interface for an error tracker (compatible with Sentry)
export interface ErrorTracker {
    captureException(error: any, context?: Record<string, any>): void;
    captureMessage(message: string, context?: Record<string, any>): void;
}

// Default console tracker (fallback)
const consoleTracker: ErrorTracker = {
    captureException: (error, context) => console.error('[Tracker] Exception:', error, context),
    captureMessage: (message, context) => console.log('[Tracker] Message:', message, context),
};

let activeTracker: ErrorTracker = consoleTracker;

// Apps call this to inject their real Sentry instance
export const configureObservability = (tracker: ErrorTracker) => {
    activeTracker = tracker;
};

// Utilities for packages to use
import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { nanoid } from "nanoid";

// Lazy Sentry import to prevent crashes when SENTRY_DSN is missing
let Sentry: any = null;

export const initSentry = () => {
    if (!process.env.SENTRY_DSN) {
        console.log('[Observability] SENTRY_DSN not set, skipping Sentry init');
        return;
    }
    
    try {
        // Dynamic import to prevent build-time issues
        Sentry = require("@sentry/node");
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            tracesSampleRate: 1.0,
            environment: process.env.NODE_ENV || "development",
        });
    } catch (error) {
        console.warn('[Observability] Failed to initialize Sentry:', error);
    }
};

export const logError = (error: unknown, context?: Record<string, any>) => {
    console.error(error);
    if (Sentry) {
        try {
            Sentry.captureException(error, { extra: context });
        } catch {
            // Silently fail
        }
    }
};

// --- WH-112: Standard Error Handling ---
export * from "./audit";
export * from "./timeout";

export class AppError extends Error {
    constructor(
        public message: string,
        public code: string = "INTERNAL_ERROR",
        public statusCode: number = 500,
        public details?: any
    ) {
        super(message);
        this.name = "AppError";
    }
}

// --- WH-113: Request Tracing ---

export const requestId = () => async (c: Context, next: Next) => {
    const existingId = c.req.header("x-request-id");
    const id = existingId || nanoid();
    c.set("requestId", id);
    c.res.headers.set("X-Request-ID", id);
    await next();
};

export const errorHandler = async (err: Error, c: Context) => {
    const requestId = c.get("requestId");

    // 1. Log the error
    logError(err, {
        requestId,
        path: c.req.path,
        method: c.req.method,
        query: c.req.query(),
    });

    // 2. Determine Response
    if (err instanceof AppError) {
        return c.json({
            success: false,
            error: err.message,
            code: err.code,
            details: err.details,
            requestId
        }, err.statusCode as any);
    }

    if (err instanceof ZodError) {
        return c.json({
            success: false,
            error: "Validation Failed",
            code: "VALIDATION_ERROR",
            details: (err as any).errors,
            requestId
        }, 400);
    }

    if (err instanceof HTTPException) {
        return c.json({
            success: false,
            error: err.message,
            code: "HTTP_ERROR",
            requestId
        }, err.status as any);
    }

    // Default 500
    return c.json({
        success: false,
        error: "Internal Server Error",
        code: "INTERNAL_SERVER_ERROR",
        requestId
    }, 500);
};

export const logMessage = (message: string, context?: Record<string, any>) => {
    activeTracker.captureMessage(message, context);
};
