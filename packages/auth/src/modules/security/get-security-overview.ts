import { db } from "@repo/database";
import { account, session } from "@repo/database/schema";
import { desc, eq } from "drizzle-orm";

export async function getSecurityOverview(userId: string) {
    const [accounts, sessions] = await Promise.all([
        db
            .select({
                id: account.id,
                accountId: account.accountId,
                providerId: account.providerId,
                createdAt: account.createdAt,
                updatedAt: account.updatedAt,
            })
            .from(account)
            .where(eq(account.userId, userId)),
        db
            .select({
                id: session.id,
                expiresAt: session.expiresAt,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                ipAddress: session.ipAddress,
                userAgent: session.userAgent,
            })
            .from(session)
            .where(eq(session.userId, userId))
            .orderBy(desc(session.createdAt)),
    ]);

    return {
        accounts,
        sessions,
    };
}
