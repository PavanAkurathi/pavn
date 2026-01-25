import { processNotifications } from './poller';

const POLL_INTERVAL_MS = 60 * 1000; // 1 minute

console.log('[WORKER] Notification Service Started');

// Initial Run
processNotifications();

// Interval Loop
setInterval(() => {
    processNotifications();
}, POLL_INTERVAL_MS);

// Handle cleanup
process.on('SIGTERM', () => {
    console.log('[WORKER] Shutting down...');
    process.exit(0);
});
