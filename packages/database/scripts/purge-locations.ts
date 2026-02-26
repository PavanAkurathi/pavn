
import { db } from "@repo/database";
import { workerLocation } from "@repo/database/schema";
import { and, eq, lt } from "drizzle-orm";

async function purgeOldLocations() {
    console.log("[PURGE] Starting location data purge...");

    const retentionDays = 14;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(`[PURGE] Deleting 'ping' records older than ${cutoffDate.toISOString()}...`);

    try {
        const result = await db.delete(workerLocation)
            .where(and(
                eq(workerLocation.eventType, 'ping'),
                lt(workerLocation.recordedAt, cutoffDate)
            ))
            .returning({ id: workerLocation.id });

        console.log(`[PURGE] Successfully deleted ${result.length} old location records.`);
    } catch (error) {
        console.error("[PURGE] Failed to purge location records:", error);
        process.exit(1);
    }

    console.log("[PURGE] Complete.");
    process.exit(0);
}

purgeOldLocations();
