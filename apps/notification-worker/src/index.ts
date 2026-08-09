import { processNotifications } from './poller';

const POLL_INTERVAL_MS = 60 * 1000; // 1 minute

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let shuttingDown = false;
let isProcessing = false;

async function runPollCycle() {
    if (shuttingDown || isProcessing) {
        return;
    }

    isProcessing = true;

    try {
        await processNotifications();
    } catch (error) {
        console.error('[WORKER] Poll cycle failed:', error);
    } finally {
        isProcessing = false;
    }

    if (!shuttingDown) {
        pollTimer = setTimeout(() => {
            void runPollCycle();
        }, POLL_INTERVAL_MS);
    }
}

function stopWorker(signal: NodeJS.Signals) {
    shuttingDown = true;

    if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
    }

    console.log(`[WORKER] Shutting down (${signal})...`);
    process.exit(0);
}

console.log('[WORKER] Notification Service Started');
void runPollCycle();

process.on('SIGTERM', () => stopWorker('SIGTERM'));
process.on('SIGINT', () => stopWorker('SIGINT'));
