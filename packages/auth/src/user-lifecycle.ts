import { db } from "@repo/database";
import * as schema from "@repo/database/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { isValidPhoneNumber, normalizePhoneNumber } from "./providers/sms";

export function resolveRequestedUserRole(ctx: any): "admin" | "worker" {
    let role: "admin" | "worker" = "admin";

    if (ctx?.headers) {
        const parsedHeaders = new Headers(ctx.headers as Record<string, string>);
        const roleHeader = parsedHeaders.get("x-user-role");
        if (roleHeader === "worker") {
            role = "worker";
        }
    }

    if (ctx?.body && typeof ctx.body === "object" && "role" in ctx.body) {
        const bodyRole = (ctx.body as Record<string, string>).role;
        if (bodyRole === "worker") {
            role = "worker";
        }
    }

    return role;
}

export function normalizeAuthPhoneNumber(params: Record<string, unknown>) {
    if (typeof params.phoneNumber === "string" && params.phoneNumber) {
        if (!isValidPhoneNumber(params.phoneNumber)) {
            throw new Error("Invalid phone number. Use E.164 format e.g. +14155552671");
        }

        params.phoneNumber = normalizePhoneNumber(params.phoneNumber);
    }
}

async function createOrganizationForAdminSignup(userId: string, companyName: string) {
    const orgId = nanoid();
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(4);

    await db.insert(schema.organization).values({
        id: orgId,
        name: companyName,
        slug,
        createdAt: new Date(),
        metadata: JSON.stringify({ description: "" }),
    });

    await db.insert(schema.member).values({
        id: nanoid(),
        organizationId: orgId,
        userId,
        role: "admin",
        createdAt: new Date(),
    });

    return orgId;
}

async function acceptWorkerInviteRegistration(userId: string, orgId: string, inviteTokenId: string) {
    const [invite] = await db.select()
        .from(schema.invitation)
        .where(eq(schema.invitation.id, inviteTokenId))
        .limit(1);

    if (!invite) {
        console.error(`[AUTH] Worker signup attempted with invalid token ${inviteTokenId}`);
        return;
    }

    if (invite.organizationId !== orgId) {
        console.error(`[AUTH] Token org mismatch. Expected ${invite.organizationId}, got ${orgId}`);
        return;
    }

    await db.insert(schema.member).values({
        id: nanoid(),
        organizationId: orgId,
        userId,
        role: invite.role || "member",
        createdAt: new Date(),
    });

    await db.update(schema.invitation)
        .set({ status: "accepted" })
        .where(eq(schema.invitation.id, invite.id));
}

export async function handleCreatedAuthUser(user: any, ctx: any) {
    const companyName = (ctx?.body as Record<string, unknown>)?.companyName as string | undefined;
    if (companyName) {
        try {
            const orgId = await createOrganizationForAdminSignup(user.id, companyName);
            console.log(`[AUTH] Org "${companyName}" (${orgId}) created for admin user ${user.id}`);
        } catch (e) {
            console.error(`[AUTH CRITICAL] Org creation failed for user ${user.id}:`, e);
            await db
                .update(schema.user as any)
                .set({ metadata: JSON.stringify({ orgSetupFailed: true }) })
                .where(eq(schema.user.id, user.id));
            throw new Error("Account created but organization setup failed. Please contact support.");
        }
        return;
    }

    const inviteTokenId = (ctx?.body as Record<string, unknown>)?.inviteToken as string | undefined;
    const orgId = (ctx?.body as Record<string, unknown>)?.orgId as string | undefined;

    if (!inviteTokenId || !orgId || user.role !== "worker") {
        return;
    }

    try {
        await acceptWorkerInviteRegistration(user.id, orgId, inviteTokenId);
        console.log(`[AUTH] Worker ${user.id} joined Org ${orgId} via invite ${inviteTokenId}`);
    } catch (e) {
        console.error(`[AUTH ERROR] Failed to process worker invite:`, e);
    }
}
