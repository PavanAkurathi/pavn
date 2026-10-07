import { AppError } from "@repo/observability";
import { WorkerInviteInputSchema } from "@repo/contracts/workforce";
import { db } from "@repo/database";
import { worker } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { createWorker, findWorkerByPhone, parseWorkerPhone } from "./create-worker";
import { inviteWorkers } from "./invite-workers";

/**
 * "Add a worker" from the manager's side: put them on the list and, if asked
 * to, text them the invite. A number that is already on the list is refused
 * rather than merged: quietly renaming someone who is already there is worse
 * than asking. (To re-send an invite, use the invite action on that worker.)
 */
export async function addWorker(orgId: string, payload: unknown) {
    const parsed = WorkerInviteInputSchema.safeParse(payload);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message || "Invalid worker",
            "VALIDATION_ERROR",
            400,
            parsed.error.flatten(),
        );
    }

    const { invites, ...fields } = parsed.data;

    if (invites.sms && !fields.phoneNumber) {
        throw new AppError(
            "Add a mobile number to text them the invite.",
            "VALIDATION_ERROR",
            400,
        );
    }

    const phoneNumber = parseWorkerPhone(fields.phoneNumber);
    const existing = phoneNumber ? await findWorkerByPhone(orgId, phoneNumber) : null;
    if (existing) {
        throw new AppError(
            `${existing.name} already has this phone number. Use their invite action to text them again.`,
            "WORKER_ALREADY_EXISTS",
            409,
        );
    }

    const saved = await createWorker(orgId, fields);

    let link: string | undefined;
    if (invites.sms) {
        const result = await inviteWorkers(orgId, [saved.id]);
        link = result.links[saved.id];
        const skip = result.skipped[0];
        if (skip) {
            throw new AppError(skip.reason, "INVITE_SKIPPED", 409);
        }
    }

    const [fresh] = await db.select().from(worker).where(eq(worker.id, saved.id)).limit(1);
    return { worker: fresh ?? saved, link };
}
