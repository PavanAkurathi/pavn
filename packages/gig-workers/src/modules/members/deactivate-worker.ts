import { db } from "@repo/database";
import { member } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { AppError } from "@repo/observability";

export const deactivateWorker = async (id: string, orgId: string) => {
    const existing = await db.query.member.findFirst({
        where: and(
            eq(member.id, id),
            eq(member.organizationId, orgId)
        )
    });

    if (!existing) {
        throw new AppError("Member not found", "NOT_FOUND", 404);
    }

    const updated = await db
        .update(member)
        .set({
            status: "inactive",
            updatedAt: new Date(),
        })
        .where(eq(member.id, id))
        .returning();

    return updated[0];
};
