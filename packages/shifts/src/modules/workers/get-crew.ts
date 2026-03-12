import { db } from "@repo/database";
import { member, user, workerRole } from "@repo/database/schema";
import { eq, notInArray, and, ilike, inArray } from "drizzle-orm";
import { getInitials } from "../../utils/formatting";
import { deriveCrewRoles } from "../../utils/crew-roles";

export const getCrew = async (orgId: string, options: { search?: string, limit?: number, offset?: number } = {}) => {
    const { search, limit = 50, offset = 0 } = options;

    const whereClause = and(
        eq(member.organizationId, orgId),
        notInArray(member.role, ['admin', 'manager', 'owner']),
        search ? ilike(user.name, `%${search}%`) : undefined
    );

    const crew = await db.select({
        memberId: member.id,
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        jobTitle: member.jobTitle,
        status: member.status,
    })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(whereClause)
        .limit(limit)
        .offset(offset);

    const workerIds = Array.from(new Set(crew.map((worker) => worker.id)));

    const explicitRoles = workerIds.length === 0
        ? []
        : await db.query.workerRole.findMany({
            where: and(
                eq(workerRole.organizationId, orgId),
                inArray(workerRole.workerId, workerIds)
            ),
            columns: {
                workerId: true,
                role: true,
            }
        });

    const rolesByWorker = new Map<string, string[]>();
    for (const role of explicitRoles) {
        const list = rolesByWorker.get(role.workerId) || [];
        list.push(role.role);
        rolesByWorker.set(role.workerId, list);
    }

    const formattedCrew = crew.map(worker => {
        const roles = deriveCrewRoles(
            rolesByWorker.get(worker.id) || [],
            worker.jobTitle || null
        );

        return {
            memberId: worker.memberId,
            id: worker.id,
            name: worker.name,
            email: worker.email,
            image: worker.image,
            avatar: worker.image, // Map DB 'image' to Frontend 'avatar'
            role: roles[0],
            roles,
            jobTitle: worker.jobTitle,
            status: worker.status,
            initials: getInitials(worker.name),
            hours: 0 // Mock 0 hours for now
        };
    });

    return formattedCrew;
};
