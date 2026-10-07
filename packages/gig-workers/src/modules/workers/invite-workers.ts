import { db } from "@repo/database";
import { organization, worker } from "@repo/database/schema";
import { sendSMS } from "@repo/auth";
import { dub } from "@repo/dub";
import { AppError } from "@repo/observability";
import { and, eq, inArray } from "drizzle-orm";
import { generateInviteCode } from "./invite-code";

export type InviteSkip = { id: string; name: string; reason: string };

const INVITE_DOMAIN = () => process.env.NEXT_PUBLIC_DUB_DOMAIN || "links.workershive.com";

/** The page the worker app opens for an invite; the code is what the business handed out. */
export function buildWorkerInviteUrl(inviteCode: string): string {
    return `https://${INVITE_DOMAIN()}/invite/${inviteCode}`;
}

async function shortenInviteUrl(url: string): Promise<string> {
    if (!process.env.DUB_API_KEY?.trim()) {
        return url;
    }
    const link = await dub.links.create({ url, domain: INVITE_DOMAIN() });
    return link.shortLink;
}

async function ensureInviteCode(workerId: string, existing: string | null): Promise<string> {
    if (existing) {
        return existing;
    }

    // Eight characters from a 31-letter alphabet: a clash is vanishingly rare,
    // but the unique index would reject it, so retry rather than fail.
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateInviteCode();
        try {
            const [updated] = await db
                .update(worker)
                .set({ inviteCode: code })
                .where(eq(worker.id, workerId))
                .returning({ inviteCode: worker.inviteCode });
            if (updated?.inviteCode) {
                return updated.inviteCode;
            }
        } catch {
            // unique violation: try another code
        }
    }
    throw new AppError("Could not create an invite code", "INTERNAL_ERROR", 500);
}

/**
 * Texts each worker the business's invite: a link into the app plus the code.
 * Only workers with a phone number can be invited, because the phone number is
 * the only way into the worker app. Someone who has already signed in, or who
 * is inactive, is skipped.
 */
export async function inviteWorkers(orgId: string, workerIds: string[]) {
    if (workerIds.length === 0) {
        return { invited: 0, skipped: [] as InviteSkip[], links: {} as Record<string, string> };
    }

    const [org] = await db
        .select({ name: organization.name })
        .from(organization)
        .where(eq(organization.id, orgId))
        .limit(1);

    if (!org) {
        throw new AppError("Organization not found", "NOT_FOUND", 404);
    }

    const rows = await db
        .select()
        .from(worker)
        .where(and(eq(worker.organizationId, orgId), inArray(worker.id, workerIds)));

    const skipped: InviteSkip[] = [];
    const links: Record<string, string> = {};
    let invited = 0;

    for (const row of rows) {
        if (row.employmentType === "agency") {
            skipped.push({ id: row.id, name: row.name, reason: "Agency temps don't use the app." });
            continue;
        }
        if (!row.phoneNumber) {
            skipped.push({ id: row.id, name: row.name, reason: "Add a mobile number first." });
            continue;
        }
        if (row.status === "inactive") {
            skipped.push({ id: row.id, name: row.name, reason: "Reactivate them first." });
            continue;
        }
        if (row.status === "active") {
            skipped.push({ id: row.id, name: row.name, reason: "Already on the app." });
            continue;
        }

        const code = await ensureInviteCode(row.id, row.inviteCode);
        const link = await shortenInviteUrl(buildWorkerInviteUrl(code));

        try {
            await sendSMS(
                row.phoneNumber,
                `${org.name} invited you to Workers Hive. Open ${link} to join, or enter code ${code} in the app.`,
            );
        } catch (error) {
            console.error("[WorkerInvite] SMS failed:", error);
            if (process.env.NODE_ENV === "production") {
                skipped.push({ id: row.id, name: row.name, reason: "The text could not be sent." });
                continue;
            }
        }

        await db
            .update(worker)
            .set({ status: "invited", invitedAt: new Date(), updatedAt: new Date() })
            .where(eq(worker.id, row.id));

        links[row.id] = link;
        invited++;
    }

    return { invited, skipped, links };
}
