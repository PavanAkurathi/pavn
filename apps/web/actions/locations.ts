"use server";

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createLocation as createLocationService, updateLocation as updateLocationService, deleteLocation as deleteLocationService, getLocations } from "@repo/shifts-service";
import { createLocationSchema } from "@repo/shifts-service/schemas";
import { PLAN_LIMITS, SUPPORT_EMAIL } from "@repo/config";

async function getSession() {
    return await auth.api.getSession({
        headers: await headers()
    });
}

export async function createLocation(data: z.input<typeof createLocationSchema>) {
    const session = await getSession();
    const activeOrganizationId = (session?.session as any)?.activeOrganizationId as string | undefined;

    if (!activeOrganizationId) {
        return { error: "No active organization" };
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
        await createLocationService(data, activeOrganizationId);
        revalidatePath("/settings");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to create location:", error);
        return { error: error.message || "Failed to create location" };
    }
}

export async function updateLocation(id: string, data: z.input<typeof createLocationSchema>) {
    const session = await getSession();
    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    const activeOrganizationId = (session?.session as any)?.activeOrganizationId as string | undefined;

    if (!activeOrganizationId) {
        return { error: "No active organization" };
    }

    try {
        await updateLocationService(data, id, activeOrganizationId);
        revalidatePath("/settings");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update location:", error);
        return { error: error.message || "Failed to update location" };
    }
}

export async function deleteLocation(locationId: string) {
    const session = await getSession();
    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    const activeOrganizationId = (session?.session as any)?.activeOrganizationId as string | undefined;

    if (!activeOrganizationId) {
        return { error: "No active organization" };
    }

    try {
        await deleteLocationService(locationId, activeOrganizationId);
        revalidatePath("/settings");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete location:", error);
        return { error: error.message || "Failed to delete location" };
    }
}

