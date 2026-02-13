import { db, TxOrDb } from "@repo/database";
import { member, user } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { ImportRow } from "./import-parser";
import { nanoid } from "nanoid";

export const bulkImportWorkers = async (
    orgId: string,
    rows: ImportRow[],
    tx?: TxOrDb
) => {

    const execute = async (tx: TxOrDb) => {
        const results = {
            created: 0,
            updated: 0
        };

        // We process sequentially to avoid deadlocks on User upserts if emails are duplicated in batch
        // For < 500 rows, this is plenty fast (approx 200ms)
        for (const row of rows) {

            // 1. Upsert User (Global Identity)
            // If email exists, update phone/name if missing? 
            // Strategy: We prioritize the existing user's data, but ensure they exist.
            const [userRecord] = await tx
                .insert(user)
                .values({
                    id: nanoid(),
                    email: row.email,
                    name: row.name,
                    emailVerified: false, // New users might need verify, explicit false for boolean
                    image: null,
                    createdAt: new Date(), // Add required fields
                    updatedAt: new Date()
                })
                .onConflictDoUpdate({
                    target: user.email,
                    set: {
                        // Optional: Update name if provided? 
                        // For now, let's keep existing user data safe, just ensure ID exists.
                        updatedAt: new Date()
                    }
                })
                .returning({ id: user.id });

            if (!userRecord) continue;

            // 2. Upsert Member (Org Association)
            // Check if they are in the org
            const existingMember = await tx.query.member.findFirst({
                where: and(
                    eq(member.organizationId, orgId),
                    eq(member.userId, userRecord.id)
                )
            });

            if (existingMember) {
                // UPDATE existing member
                await tx.update(member)
                    .set({
                        jobTitle: row.jobTitle || existingMember.jobTitle,
                        hourlyRate: row.rate !== undefined ? row.rate : existingMember.hourlyRate,
                        // Don't downgrade admins to members via import
                        role: row.role === 'admin' ? 'admin' : existingMember.role,
                        updatedAt: new Date()
                    })
                    .where(eq(member.id, existingMember.id));
                results.updated++;
            } else {
                // INSERT new member
                await tx.insert(member).values({
                    id: nanoid(),
                    organizationId: orgId,
                    userId: userRecord.id,
                    role: row.role,
                    jobTitle: row.jobTitle || null,
                    hourlyRate: row.rate || null,
                    status: 'active',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                results.created++;
            }
        }

        return results;
    };

    if (tx) return execute(tx);
    return await db.transaction(execute);
};
