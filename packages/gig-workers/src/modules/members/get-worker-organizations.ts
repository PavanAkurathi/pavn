import { db } from "@repo/database";
import { member, organization } from "@repo/database/schema";
import { and, eq } from "drizzle-orm";

export async function getWorkerOrganizations(userId: string) {
    const memberships = await db
        .select({
            orgId: member.organizationId,
            role: member.role,
            orgName: organization.name,
            orgLogo: organization.logo,
        })
        .from(member)
        .innerJoin(organization, eq(member.organizationId, organization.id))
        .where(and(
            eq(member.userId, userId),
            eq(member.status, "active"),
        ));

    return memberships.map((membership) => ({
        id: membership.orgId,
        name: membership.orgName,
        logo: membership.orgLogo,
        role: membership.role,
    }));
}
