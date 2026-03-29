import { dispatchPendingNotifications } from "@repo/notifications";

export async function processNotifications() {
    try {
        const result = await dispatchPendingNotifications();
        console.log(
            `[WORKER] Processed: ${result.processed}, Sent: ${result.sent}, Failed: ${result.failed}, Retry: ${result.skipped}`
        );
    } catch (error) {
        console.error("[WORKER] Error in polling loop:", error);
    }
}
