import { and, eq, inArray } from "drizzle-orm";
import { db } from "@repo/database";
import { member, organization, user, worker } from "@repo/database/schema";
import { isValidPhoneNumber, normalizePhoneNumber } from "./providers/sms";

/**
 * Who gets into the worker app. Nobody signs themselves up: a business adds a
 * worker (name + phone) and invites them, and that invited worker row is the
 * only thing that makes a phone number eligible. Statuses that count:
 * 'invited' (waiting for them to sign in) and 'active' (already have).
 * A worker who is only 'added', or who was made 'inactive', cannot sign in.
 */
const ELIGIBLE_STATUSES = ["invited", "active"] as const;

type WorkerAccessRow = {
    workerId: string;
    organizationId: string;
    organizationName: string;
    userId: string | null;
    name: string;
    status: string;
};

export type WorkerPhoneAccess = {
    normalizedPhoneNumber: string;
    eligible: boolean;
    organizationCount: number;
    existingAccount: boolean;
    existingUserId: string | null;
    displayName: string | null;
    organizationIds: string[];
    workerAccess: WorkerAccessRow[];
};

export function getWorkerTempEmail(phoneNumber: string): string {
    const digits = phoneNumber.replace(/\D/g, "");
    return `worker+${digits}@workershive.local`;
}

export async function getWorkerPhoneAccess(phoneNumber: string): Promise<WorkerPhoneAccess> {
    if (!isValidPhoneNumber(phoneNumber)) {
        throw new Error("Invalid phone number");
    }

    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

    const existingUser = await db.query.user.findFirst({
        where: eq(user.phoneNumber, normalizedPhoneNumber),
        columns: {
            id: true,
            name: true,
        },
    });

    const workerAccess = await db
        .select({
            workerId: worker.id,
            organizationId: worker.organizationId,
            organizationName: organization.name,
            userId: worker.userId,
            name: worker.name,
            status: worker.status,
        })
        .from(worker)
        .innerJoin(organization, eq(worker.organizationId, organization.id))
        .where(and(
            eq(worker.phoneNumber, normalizedPhoneNumber),
            inArray(worker.status, [...ELIGIBLE_STATUSES]),
        ));

    const organizationIds = [...new Set(workerAccess.map((row) => row.organizationId))];

    // A brand-new account is named after its phone number; the business's name
    // for the person is the better one until they set their own.
    const accountNameIsPlaceholder =
        !existingUser?.name || existingUser.name === normalizedPhoneNumber || existingUser.name === phoneNumber;
    const displayName = accountNameIsPlaceholder
        ? (workerAccess[0]?.name ?? existingUser?.name ?? null)
        : existingUser!.name;

    return {
        normalizedPhoneNumber,
        eligible: organizationIds.length > 0,
        organizationCount: organizationIds.length,
        existingAccount: Boolean(existingUser),
        existingUserId: existingUser?.id ?? null,
        displayName,
        organizationIds,
        workerAccess,
    };
}

/**
 * What an invite code points at, for the worker app's invite screen. Only says
 * which business and which person; the phone number still has to match.
 */
export async function getWorkerInviteByCode(code: string) {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
        return null;
    }

    const [row] = await db
        .select({
            workerId: worker.id,
            name: worker.name,
            phoneNumber: worker.phoneNumber,
            status: worker.status,
            organizationName: organization.name,
        })
        .from(worker)
        .innerJoin(organization, eq(worker.organizationId, organization.id))
        .where(eq(worker.inviteCode, trimmed))
        .limit(1);

    if (!row || !ELIGIBLE_STATUSES.includes(row.status as (typeof ELIGIBLE_STATUSES)[number])) {
        return null;
    }

    return {
        workerId: row.workerId,
        workerName: row.name,
        organizationName: row.organizationName,
        // Enough for "the number ending in 42", not enough to leak it.
        phoneHint: row.phoneNumber ? row.phoneNumber.slice(-2) : null,
    };
}

/**
 * Runs after a worker proves they own a phone number: attach this account to
 * every business that invited that number, and give it membership in each.
 */
export async function syncWorkerMembershipsForPhone(userId: string, phoneNumber: string): Promise<string[]> {
    const access = await getWorkerPhoneAccess(phoneNumber);
    if (!access.eligible) {
        throw new Error("This phone number has not been invited to any organization.");
    }

    const now = new Date();

    for (const row of access.workerAccess) {
        // A number someone else already signed in with stays theirs.
        if (row.userId && row.userId !== userId) {
            continue;
        }

        // Already attached to another worker row in the same business (a stale one).
        const alreadyLinked = await db.query.worker.findFirst({
            where: and(
                eq(worker.organizationId, row.organizationId),
                eq(worker.userId, userId),
            ),
            columns: { id: true },
        });
        if (alreadyLinked && alreadyLinked.id !== row.workerId) {
            continue;
        }

        await db
            .update(worker)
            .set({ userId, status: "active", updatedAt: now })
            .where(eq(worker.id, row.workerId));

        const existingMembership = await db.query.member.findFirst({
            where: and(
                eq(member.userId, userId),
                eq(member.organizationId, row.organizationId),
            ),
            columns: { id: true, status: true },
        });

        if (!existingMembership) {
            await db.insert(member).values({
                id: crypto.randomUUID(),
                organizationId: row.organizationId,
                userId,
                role: "member",
                status: "active",
                createdAt: now,
                updatedAt: now,
            });
        } else if (existingMembership.status !== "active") {
            await db
                .update(member)
                .set({ status: "active", updatedAt: now })
                .where(eq(member.id, existingMembership.id));
        }
    }

    const existingUser = await db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: {
            id: true,
            name: true,
        },
    });

    const nextUserValues: {
        role: string;
        updatedAt: Date;
        name?: string;
    } = {
        role: "worker",
        updatedAt: now,
    };

    if (
        access.displayName &&
        existingUser &&
        (!existingUser.name || existingUser.name === access.normalizedPhoneNumber || existingUser.name === phoneNumber)
    ) {
        nextUserValues.name = access.displayName;
    }

    await db.update(user).set(nextUserValues).where(eq(user.id, userId));

    return access.organizationIds;
}
