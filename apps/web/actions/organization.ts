// apps/web/actions/organization.ts

"use server";

import { db, and, eq } from "@repo/database";
import { member, organization } from "@repo/database/schema";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ATTENDANCE_VERIFICATION_POLICY_VALUES } from "@repo/config";
import {
    parseOrganizationMetadata,
    serializeOrganizationMetadata,
} from "@/lib/organization-metadata";
import { resolveActiveOrganizationId } from "@/lib/active-organization";
import { isAdminOrganizationRole } from "@/lib/server/organization-roles";

async function getSession() {
    return await auth.api.getSession({
        headers: await headers()
    });
}

const updateOrgSchema = z.object({
    name: z.string().min(2).max(50),
    description: z.string().optional(),
    timezone: z.string().min(1).optional(),
    attendanceVerificationPolicy: z.enum(ATTENDANCE_VERIFICATION_POLICY_VALUES).optional(),
    markBusinessInformationComplete: z.boolean().optional(),
});

export async function updateOrganization(data: z.infer<typeof updateOrgSchema>) {
    const session = await getSession();
    if (!session) {
        return { error: "Unauthorized" };
    }

    const activeOrganizationId = session
        ? await resolveActiveOrganizationId(
              session.user.id,
              (session.session as any)?.activeOrganizationId as string | undefined,
          )
        : null;

    if (!activeOrganizationId) {
        return { error: "No active organization" };
    }

    const membership = await db.query.member.findFirst({
        where: and(
            eq(member.organizationId, activeOrganizationId),
            eq(member.userId, session.user.id)
        ),
        columns: {
            role: true,
        },
    });

    if (!membership || !isAdminOrganizationRole(membership.role)) {
        return { error: "Only admins can update business settings." };
    }

    const valResult = updateOrgSchema.safeParse(data);
    if (!valResult.success) {
        return { error: "Invalid input: " + (valResult.error.issues[0]?.message || "Unknown error") };
    }
    const safeData = valResult.data;

    try {
        const currentOrg = await db.query.organization.findFirst({
            where: eq(organization.id, activeOrganizationId),
            columns: {
                metadata: true,
            },
        });
        const metadata = parseOrganizationMetadata(currentOrg?.metadata);

        if (safeData.description !== undefined) {
            metadata.description = safeData.description;
        }

        if (safeData.markBusinessInformationComplete) {
            metadata.onboarding = {
                ...metadata.onboarding,
                businessInformationCompleted: true,
            };
        }

        await db.update(organization)
            .set({
                name: safeData.name,
                metadata: serializeOrganizationMetadata(metadata),
                timezone: safeData.timezone,
                attendanceVerificationPolicy: safeData.attendanceVerificationPolicy,
            })
            .where(eq(organization.id, activeOrganizationId));

        revalidatePath("/settings");
        revalidatePath("/dashboard/onboarding");
        return { success: true };
    } catch (error) {
        console.error("Failed to update organization:", error);
        return { error: "Failed to update organization" };
    }
}

export async function markBillingPromptHandled() {
    const session = await getSession();
    if (!session) {
        return { error: "Unauthorized" };
    }

    const activeOrganizationId = session
        ? await resolveActiveOrganizationId(
              session.user.id,
              (session.session as any)?.activeOrganizationId as string | undefined,
          )
        : null;

    if (!activeOrganizationId) {
        return { error: "No active organization" };
    }

    const membership = await db.query.member.findFirst({
        where: and(
            eq(member.organizationId, activeOrganizationId),
            eq(member.userId, session.user.id)
        ),
        columns: {
            role: true,
        },
    });

    if (!membership || !isAdminOrganizationRole(membership.role)) {
        return { error: "Only admins can change billing setup progress." };
    }

    try {
        const currentOrg = await db.query.organization.findFirst({
            where: eq(organization.id, activeOrganizationId),
            columns: {
                metadata: true,
            },
        });
        const metadata = parseOrganizationMetadata(currentOrg?.metadata);
        metadata.onboarding = {
            ...metadata.onboarding,
            billingPromptHandled: true,
        };

        await db.update(organization)
            .set({
                metadata: serializeOrganizationMetadata(metadata),
            })
            .where(eq(organization.id, activeOrganizationId));

        revalidatePath("/settings");
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/onboarding");
        return { success: true };
    } catch (error) {
        console.error("Failed to mark billing prompt handled:", error);
        return { error: "Failed to update onboarding progress" };
    }
}
