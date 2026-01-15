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
export const logError = (error: any, context?: Record<string, any>) => {
    activeTracker.captureException(error, context);
};

export const logMessage = (message: string, context?: Record<string, any>) => {
    activeTracker.captureMessage(message, context);
};
