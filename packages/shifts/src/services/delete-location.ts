import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";

export const deleteLocation = async (id: string, orgId: string) => {
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

    const [deletedRecord] = await db
        .delete(location)
        .where(eq(location.id, id))
        .returning();

    if (!deletedRecord) {
        throw new Error("Failed to delete location");
    }

    return { success: true, id: deletedRecord.id };
};
