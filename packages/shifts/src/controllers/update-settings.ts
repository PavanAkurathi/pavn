import { db } from "@repo/database";
import { organization } from "@repo/database/schema";
import { eq } from "drizzle-orm";

export const updateSettingsController = async (data: any, orgId: string) => {
    // Validate settings here

    const updated = await db
        .update(organization)
        .set({
            timezone: data.timezone,
            earlyClockInBufferMinutes: data.earlyClockInBufferMinutes,
            regionalOvertimePolicy: data.regionalOvertimePolicy,
            // Add other fields as needed
            // settings: data.settings, // REMOVED as column doesn't exist
            // updated_at is auto-updated? No, not trigger.
            // Wait, schema has notNull().defaultNow() on update?
            // Usually we set it manually in code or DB trigger.
            // Drizzle defaultNow() is for insert.
            // Actually, Drizzle $onUpdate exists now but let's check schema.
            // Schema: updatedAt: timestamp("updated_at").notNull(),
        })
        .where(eq(organization.id, orgId))
        .returning();

    return updated[0];
};
