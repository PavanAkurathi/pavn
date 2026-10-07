import { db } from "@repo/database";
import { worker } from "@repo/database/schema";
import { and, asc, eq, ilike } from "drizzle-orm";
import { toCrewMember } from "./worker-mapper";

export const getCrew = async (
    orgId: string,
    options: { search?: string; limit?: number; offset?: number } = {},
) => {
    const { search, limit = 50, offset = 0 } = options;

    const rows = await db
        .select()
        .from(worker)
        .where(and(
            eq(worker.organizationId, orgId),
            search ? ilike(worker.name, `%${search}%`) : undefined,
        ))
        .orderBy(asc(worker.name))
        .limit(limit)
        .offset(offset);

    return rows.map(toCrewMember);
};
