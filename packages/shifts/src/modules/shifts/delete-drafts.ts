import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";

export const deleteDrafts = async (orgId: string) => {
    await db.delete(shift)
        .where(
            and(
                eq(shift.organizationId, orgId),
                eq(shift.status, 'draft')
            )
        );

    return { success: true, message: "Drafts deleted" };
};
