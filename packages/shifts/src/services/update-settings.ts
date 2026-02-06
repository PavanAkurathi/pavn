import { db } from "@repo/database";
import { organization } from "@repo/database/schema";
import { eq } from "drizzle-orm";

export const updateSettings = async (data: any, orgId: string) => {
    // Validate settings here (TODO: Add Zod)

    const updated = await db
        .update(organization)
        .set({
            timezone: data.timezone,
            earlyClockInBufferMinutes: data.earlyClockInBufferMinutes,
            regionalOvertimePolicy: data.regionalOvertimePolicy,
        })
        .where(eq(organization.id, orgId))
        .returning();

    return updated[0];
};
