import { db } from "@repo/database";
import { member, shiftAssignment, worker } from "@repo/database/schema";
import { AppError } from "@repo/observability";
import { and, eq } from "drizzle-orm";

async function setMemberStatus(orgId: string, userId: string | null, status: "active" | "inactive") {
    if (!userId) {
        return;
    }
    await db
        .update(member)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));
}

async function loadWorker(id: string, orgId: string) {
    const existing = await db.query.worker.findFirst({
        where: and(eq(worker.id, id), eq(worker.organizationId, orgId)),
    });

    if (!existing) {
        throw new AppError("Worker not found", "NOT_FOUND", 404);
    }

    return existing;
}

/** Pauses a worker: off the schedule pickers and out of the app, but kept on the list. */
export const deactivateWorker = async (id: string, orgId: string) => {
    const existing = await loadWorker(id, orgId);

    await setMemberStatus(orgId, existing.userId, "inactive");

    const [updated] = await db
        .update(worker)
        .set({ status: "inactive", updatedAt: new Date() })
        .where(eq(worker.id, id))
        .returning();

    return updated;
};

/**
 * Takes a worker off the list. Someone who has never worked a shift is deleted;
 * anyone with history (timesheets hang off them) is kept as inactive so their
 * hours stay on the record. Either way a signed-in worker loses access to the
 * business straight away.
 */
export const removeWorker = async (id: string, orgId: string) => {
    const existing = await loadWorker(id, orgId);

    const [hasHistory] = await db
        .select({ id: shiftAssignment.id })
        .from(shiftAssignment)
        .where(eq(shiftAssignment.workerId, id))
        .limit(1);

    await setMemberStatus(orgId, existing.userId, "inactive");

    if (!hasHistory) {
        await db.delete(worker).where(eq(worker.id, id));
        return { id, removed: true as const, status: "removed" as const };
    }

    await db
        .update(worker)
        .set({ status: "inactive", updatedAt: new Date() })
        .where(eq(worker.id, id));

    return { id, removed: false as const, status: "inactive" as const };
};

export const reactivateWorker = async (id: string, orgId: string) => {
    const existing = await loadWorker(id, orgId);

    // Back to where they were: signed in, told about the app, or just listed.
    const status = existing.userId ? "active" : existing.invitedAt ? "invited" : "added";

    await setMemberStatus(orgId, existing.userId, "active");

    const [updated] = await db
        .update(worker)
        .set({ status, updatedAt: new Date() })
        .where(eq(worker.id, id))
        .returning();

    return updated;
};
