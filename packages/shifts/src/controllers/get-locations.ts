import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { eq, desc } from "drizzle-orm";
import { LocationSchema } from "../schemas";

export const getLocationsController = async (orgId: string) => {
    const locations = await db
        .select()
        .from(location)
        .where(eq(location.organizationId, orgId))
        .orderBy(desc(location.createdAt));

    return locations;
};
