import { and, eq } from "drizzle-orm";
import { db, TxOrDb } from "./db";
import { worker } from "./schema";

/**
 * The worker row an app account is at one business: the id shift assignments
 * point at. Null when the account has no worker there (never invited, or the
 * number belongs to someone else).
 */
export async function findWorkerIdForUser(
    userId: string,
    orgId: string,
    executor: TxOrDb = db,
): Promise<string | null> {
    const row = await executor.query.worker.findFirst({
        where: and(eq(worker.userId, userId), eq(worker.organizationId, orgId)),
        columns: { id: true },
    });
    return row?.id ?? null;
}
