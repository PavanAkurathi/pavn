import { db } from "@repo/database";
import { member } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";

export const updateWorkerController = async (data: any, id: string, orgId: string) => {
    // Ensure member belongs to org
    const existing = await db.query.member.findFirst({
        where: and(
            eq(member.id, id),
            eq(member.organizationId, orgId)
        )
    });

    if (!existing) {
        throw new Error("Member not found");
    }

    const updated = await db
        .update(member)
        .set({
            ...data, // TODO: Validate allowed fields
            updatedAt: new Date(),
        })
        .where(eq(member.id, id))
        .returning();

    return updated[0];
};
