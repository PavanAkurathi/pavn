import { db } from "@repo/database";
import * as schema from "@repo/database/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { logError, logMessage } from "@repo/observability";
import { isValidPhoneNumber, normalizePhoneNumber } from "./providers/sms";

interface AuthHookContext {
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
}

export function resolveRequestedUserRole(ctx: Record<string, unknown> | null): "admin" | "worker" {
    if (!ctx) return "admin";
    let role: "admin" | "worker" = "admin";

    const hookCtx = ctx as unknown as AuthHookContext;

    if (hookCtx?.headers) {
        const parsedHeaders = new Headers(hookCtx.headers);
        const roleHeader = parsedHeaders.get("x-user-role");
        if (roleHeader === "worker") {
            role = "worker";
        }
    }

    if (hookCtx?.body && typeof hookCtx.body === "object" && "role" in hookCtx.body) {
        const bodyRole = hookCtx.body.role;
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

export async function handleCreatedAuthUser(user: Record<string, unknown>, ctx: Record<string, unknown> | null) {
    const hookCtx = ctx as unknown as AuthHookContext;
    const companyName = hookCtx?.body?.companyName as string | undefined;
    const userId = user.id as string;

    if (companyName) {
        try {
            const orgId = await createOrganizationForAdminSignup(userId, companyName);
            logMessage("[AUTH] Organization created for admin signup", { orgId, userId });
        } catch (e) {
            logError(e, { context: "org_creation_on_signup", userId });
            // Note: orgSetupFailed is tracked via observability logging.
            // The user table has no metadata column — do not attempt to write there.
            throw new Error("Account created but organization setup failed. Please contact support.");
        }
        return;
    }
}
