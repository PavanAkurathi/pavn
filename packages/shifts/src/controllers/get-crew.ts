import { db } from "@repo/database";
import { member, user } from "@repo/database/schema";
import { eq } from "drizzle-orm";

export const getCrewController = async (orgId: string): Promise<Response> => {
    // Join Member -> User to get names/avatars
    const crew = await db.select({
        id: user.id,
        name: user.name,
        image: user.image,
        role: member.role // or however you store "Bartender" vs "Server" tags
    })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(eq(member.organizationId, orgId));

    return Response.json(crew, { status: 200 });
};
