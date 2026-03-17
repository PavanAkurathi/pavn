import { db } from "@repo/database";
import { workerAvailability, member } from "@repo/database/schema";
import { eq, and, inArray, gte, lte } from "drizzle-orm";

export const getAvailability = async (orgId: string, from: string, to: string, queryWorkerId?: string) => {
    const members = await db.select({ userId: member.userId })
        .from(member)
        .where(eq(member.organizationId, orgId));

    const allWorkerIds = members.map((record) => record.userId);
    if (allWorkerIds.length === 0) {
        return [];
    }

    let targetWorkerIds = allWorkerIds;
    if (queryWorkerId) {
        if (!allWorkerIds.includes(queryWorkerId)) {
            return [];
        }
        targetWorkerIds = [queryWorkerId];
    }

    const start = new Date(from);
    const end = new Date(to);

    return db.query.workerAvailability.findMany({
        where: and(
            inArray(workerAvailability.workerId, targetWorkerIds),
            gte(workerAvailability.endTime, start),
            lte(workerAvailability.startTime, end)
        ),
        orderBy: (avail, { asc }) => [asc(avail.startTime)]
    });
};
