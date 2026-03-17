import { db, TxOrDb } from "@repo/database";
import { member, user } from "@repo/database/schema";
import { resolveWorkerRoleSet, upsertWorkerRolesForOrganization } from "@repo/database";
import { eq, and } from "drizzle-orm";
import { ImportRow } from "./import-parser";
import { nanoid } from "nanoid";

export const bulkImportWorkers = async (
    orgId: string,
    rows: ImportRow[],
    tx?: TxOrDb
) => {
    const execute = async (transaction: TxOrDb) => {
        const results = {
            created: 0,
            updated: 0
        };

        for (const row of rows) {
            const resolvedRoles = resolveWorkerRoleSet({
                roles: row.roles,
                fallbackRole: row.jobTitle,
            });
            const primaryRole = resolvedRoles[0] ?? row.jobTitle ?? null;

            const [userRecord] = await transaction
                .insert(user)
                .values({
                    id: nanoid(),
                    email: row.email,
                    name: row.name,
                    emailVerified: false,
                    image: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
                .onConflictDoUpdate({
                    target: user.email,
                    set: {
                        updatedAt: new Date()
                    }
                })
                .returning({ id: user.id });

            if (!userRecord) continue;

            const existingMember = await transaction.query.member.findFirst({
                where: and(
                    eq(member.organizationId, orgId),
                    eq(member.userId, userRecord.id)
                )
            });

            if (existingMember) {
                await transaction.update(member)
                    .set({
                        jobTitle: primaryRole || existingMember.jobTitle,
                        hourlyRate: row.rate !== undefined ? row.rate : existingMember.hourlyRate,
                        role: row.role === "admin" ? "admin" : existingMember.role,
                        updatedAt: new Date()
                    })
                    .where(eq(member.id, existingMember.id));
                results.updated++;
            } else {
                await transaction.insert(member).values({
                    id: nanoid(),
                    organizationId: orgId,
                    userId: userRecord.id,
                    role: row.role,
                    jobTitle: primaryRole,
                    hourlyRate: row.rate || null,
                    status: "active",
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                results.created++;
            }

            await upsertWorkerRolesForOrganization({
                workerId: userRecord.id,
                organizationId: orgId,
                roles: resolvedRoles,
                hourlyRate: row.rate,
            }, transaction);
        }

        return results;
    };

    if (tx) return execute(tx);
    return db.transaction(execute);
};
