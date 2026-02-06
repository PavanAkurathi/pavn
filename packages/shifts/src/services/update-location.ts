import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { LocationSchema } from "../schemas";

export const updateLocation = async (data: any, id: string, orgId: string) => {
    const validatedData = LocationSchema.partial().parse(data);

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

    const updated = await db
        .update(location)
        .set({
            ...validatedData,
            updatedAt: new Date(),
        })
        .where(eq(location.id, id))
        .returning();

    return updated[0];
};
