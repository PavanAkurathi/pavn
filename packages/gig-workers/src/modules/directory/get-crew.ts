import { db } from "@repo/database";
import { member, rosterEntry, user, workerRole } from "@repo/database/schema";
import { eq, and, ilike, inArray } from "drizzle-orm";
import { getInitials } from "../../utils/formatting";
import { deriveCrewRoles } from "../../utils/crew-roles";

export const getCrew = async (orgId: string, options: { search?: string, limit?: number, offset?: number } = {}) => {
    const { search, limit = 50, offset = 0 } = options;

    // Managers work shifts. In a small staffing operation the owner is often the
    // one covering a gap at 5am, and excluding them from their own crew pool
    // meant the business could not schedule the person most likely to turn up.
    // Whether someone can be scheduled is about being in the organisation, not
    // about their permissions inside it.
    const whereClause = and(
        eq(member.organizationId, orgId),
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

    const activeCrew = crew.map((worker) => {
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
            avatar: worker.image,
            role: roles[0],
            roles,
            jobTitle: worker.jobTitle,
            status: worker.status,
            initials: getInitials(worker.name),
            hours: 0
        };
    });

    // Invited in-house workers without accounts yet: schedulable immediately;
    // their assignments migrate to the real account on invite acceptance.
    const activeEmails = new Set(activeCrew.map((w) => (w.email || "").toLowerCase()));
    const pendingEntries = await db.query.rosterEntry.findMany({
        where: and(
            eq(rosterEntry.organizationId, orgId),
            search ? ilike(rosterEntry.name, `%${search}%`) : undefined,
        ),
    });

    const invitedCrew = pendingEntries
        .filter((entry) => !activeEmails.has(entry.email.toLowerCase()))
        .map((entry) => ({
            memberId: entry.id,
            id: entry.id,
            name: entry.name,
            email: entry.email,
            image: null as string | null,
            avatar: null as string | null,
            role: entry.roles?.[0] ?? entry.jobTitle ?? undefined,
            roles: entry.roles?.length ? entry.roles : (entry.jobTitle ? [entry.jobTitle] : []),
            jobTitle: entry.jobTitle,
            status: "invited",
            initials: getInitials(entry.name),
            hours: 0,
            invitePending: true,
        }));

    return [...activeCrew, ...invitedCrew];
};
