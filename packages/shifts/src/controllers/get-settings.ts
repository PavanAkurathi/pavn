import { db } from "@repo/database";
import { organization } from "@repo/database/schema";
import { eq } from "drizzle-orm";

export const getSettingsController = async (orgId: string) => {
    const org = await db.query.organization.findFirst({
        where: eq(organization.id, orgId)
    });

    if (!org) {
        throw new Error("Organization not found");
    }

    return {
        name: org.name,
        slug: org.slug,
        timezone: org.timezone || "America/New_York",
        currencyCode: org.currencyCode,
        excessParameters: {
            earlyClockInBufferMinutes: org.earlyClockInBufferMinutes,
            breakThresholdMinutes: org.breakThresholdMinutes,
            regionalOvertimePolicy: org.regionalOvertimePolicy,
        }
    };
};
