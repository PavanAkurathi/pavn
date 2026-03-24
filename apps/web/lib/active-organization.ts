import { db, eq } from "@repo/database";
import { member } from "@repo/database/schema";

export async function resolveActiveOrganizationId(
    userId: string,
    activeOrganizationId?: string | null,
) {
    if (activeOrganizationId) {
        return activeOrganizationId;
    }

    const firstMembership = await db.query.member.findFirst({
        where: eq(member.userId, userId),
        columns: {
            organizationId: true,
        },
    });

    return firstMembership?.organizationId ?? null;
}
