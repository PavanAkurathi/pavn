// Basic interface for an error tracker (compatible with Sentry)
import { createRequire } from "node:module";

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

// Lazy Sentry import to prevent crashes when SENTRY_DSN is missing
let Sentry: any = null;
const fallbackRequireBase = `${process.cwd()}/.observability-require.cjs`;
const nodeRequire =
    typeof require === "function" ? require : createRequire(fallbackRequireBase);

export const initSentry = () => {
    if (!process.env.SENTRY_DSN) {
        console.log('[Observability] SENTRY_DSN not set, skipping Sentry init');
        return;
    }

    try {
        // Use Node's module loader so this package stays ESM-safe.
        const sentryModule = nodeRequire("@sentry/node");
        Sentry = sentryModule.default ?? sentryModule;
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
export * from "./errors";

export const logMessage = (message: string, context?: Record<string, any>) => {
    activeTracker.captureMessage(message, context);
};
