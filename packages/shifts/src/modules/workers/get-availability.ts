// packages/shifts/src/services/get-availability.ts

import { db } from "@repo/database";
import { workerAvailability, member } from "@repo/database/schema";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { AppError } from "@repo/observability";

export const getAvailability = async (orgId: string, from: string, to: string, queryWorkerId?: string) => {
    // 1. Get List of Workers in this Org
    const members = await db.select({ userId: member.userId })
        .from(member)
        .where(eq(member.organizationId, orgId));

    const allWorkerIds = members.map(m => m.userId);

    if (allWorkerIds.length === 0) {
        return [];
    }

    // Filter by specific worker if requested
    let targetWorkerIds = allWorkerIds;
    if (queryWorkerId) {
        if (!allWorkerIds.includes(queryWorkerId)) {
            return [];
        }
        targetWorkerIds = [queryWorkerId];
    }

    const start = new Date(from);
    const end = new Date(to);

    // 2. Fetch Availability for these workers within range
    const records = await db.query.workerAvailability.findMany({
        where: and(
            inArray(workerAvailability.workerId, targetWorkerIds),
            gte(workerAvailability.endTime, start),
            lte(workerAvailability.startTime, end)
        ),
        orderBy: (avail, { asc }) => [asc(avail.startTime)]
    });

    return records;
};
