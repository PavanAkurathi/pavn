import { db } from "@repo/database";
import { member, user } from "@repo/database/schema";
import { eq, notInArray, and } from "drizzle-orm";

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
        .where(
            and(
                eq(member.organizationId, orgId),
                notInArray(member.role, ['admin', 'owner', 'manager'])
            )
        );

    const formattedCrew = crew.map(worker => ({
        id: worker.id,
        name: worker.name,
        avatar: worker.image, // Map DB 'image' to Frontend 'avatar'
        roles: [worker.role], // Transform single role string to array
        initials: worker.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase(),
        hours: 0 // Mock 0 hours for now
    }));

    return Response.json(formattedCrew, { status: 200 });
};
