"use server";

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
    createLocation as createLocationService,
    createLocationSchema,
    deleteLocation as deleteLocationService,
    getLocations,
    updateLocation as updateLocationService,
} from "@repo/organizations";
import { PLAN_LIMITS, SUPPORT_EMAIL } from "@repo/config";
import { resolveActiveOrganizationId } from "@/lib/active-organization";
import { db, and, eq } from "@repo/database";
import { member } from "@repo/database/schema";
import { isAdminOrganizationRole } from "@/lib/server/organization-roles";

async function getSession() {
    return await auth.api.getSession({
        headers: await headers()
    });
}

async function ensureLocationAdminAccess(userId: string, organizationId: string) {
    const membership = await db.query.member.findFirst({
        where: and(
            eq(member.organizationId, organizationId),
            eq(member.userId, userId)
        ),
        columns: {
            role: true,
        },
    });

    if (!membership || !isAdminOrganizationRole(membership.role)) {
        return { error: "Only admins can manage business locations." };
    }

    return null;
}

export async function createLocation(data: z.input<typeof createLocationSchema>) {
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

    const accessError = await ensureLocationAdminAccess(session.user.id, activeOrganizationId);
    if (accessError) {
        return accessError;
    }

    // --- Location cap enforcement ---
    try {
        const existingLocations = await getLocations(activeOrganizationId);
        if (existingLocations.length >= PLAN_LIMITS.MAX_LOCATIONS) {
            return {
                error: `Your plan supports up to ${PLAN_LIMITS.MAX_LOCATIONS} locations. Need more? Contact us at ${SUPPORT_EMAIL} to upgrade.`
            };
        }
    } catch (e) {
        console.error("Failed to check location count:", e);
        // Don't block on count check failure — allow creation
    }

    try {
        const result = await createLocationService(data, activeOrganizationId);
        revalidatePath("/settings");
        revalidatePath("/dashboard/onboarding");
        return {
            success: true,
            warning: result.warning,
        };
    } catch (error: any) {
        console.error("Failed to create location:", error);
        return { error: error.message || "Failed to create location" };
    }
}

export async function updateLocation(id: string, data: z.input<typeof createLocationSchema>) {
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

    const accessError = await ensureLocationAdminAccess(session.user.id, activeOrganizationId);
    if (accessError) {
        return accessError;
    }

    try {
        await updateLocationService(data, id, activeOrganizationId);
        revalidatePath("/settings");
        revalidatePath("/dashboard/onboarding");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update location:", error);
        return { error: error.message || "Failed to update location" };
    }
}

export async function deleteLocation(locationId: string) {
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

    const accessError = await ensureLocationAdminAccess(session.user.id, activeOrganizationId);
    if (accessError) {
        return accessError;
    }

    try {
        await deleteLocationService(locationId, activeOrganizationId);
        revalidatePath("/settings");
        revalidatePath("/dashboard/onboarding");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete location:", error);
        return { error: error.message || "Failed to delete location" };
    }
}
