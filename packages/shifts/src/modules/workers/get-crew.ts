import { db } from "@repo/database";
import { member, user } from "@repo/database/schema";
import { eq, notInArray, and, ilike } from "drizzle-orm";
import { getInitials } from "../../utils/formatting";

export const getCrew = async (orgId: string, options: { search?: string, limit?: number, offset?: number } = {}) => {
    const { search, limit = 50, offset = 0 } = options;

    const whereClause = and(
        eq(member.organizationId, orgId),
        notInArray(member.role, ['admin', 'owner', 'manager']),
        search ? ilike(user.name, `%${search}%`) : undefined
    );

    // Join Member -> User to get names/avatars
    const crew = await db.select({
        id: user.id,
        name: user.name,
        image: user.image,
        role: member.role
    })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(whereClause)
        .limit(limit)
        .offset(offset);

    const formattedCrew = crew.map(worker => ({
        id: worker.id,
        name: worker.name,
        avatar: worker.image, // Map DB 'image' to Frontend 'avatar'
        roles: [worker.role], // Transform single role string to array
        initials: getInitials(worker.name),
        hours: 0 // Mock 0 hours for now
    }));

    return formattedCrew;
};
