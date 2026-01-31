import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";

export const deleteLocationController = async (id: string, orgId: string) => {
    // Ensure location belongs to org
    const existing = await db.query.location.findFirst({
        where: and(
            eq(location.id, id),
            eq(location.organizationId, orgId)
        )
    });

    if (!existing) {
        throw new Error("Location not found");
    }

    // TODO: Check if location is used in shifts before deleting?
    // For now, simple delete.

    const deleted = await db
        .delete(location)
        .where(eq(location.id, id))
        .returning();

    return { success: true, id: deleted[0].id };
};
