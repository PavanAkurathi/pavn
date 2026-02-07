"use server";

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
// Switch to functional exports that handle geocoding
import { createLocation as createLocationService, updateLocation as updateLocationService, deleteLocation as deleteLocationService } from "@repo/shifts-service";
import { createLocationSchema } from "@repo/shifts-service/schemas";

async function getSession() {
    return await auth.api.getSession({
        headers: await headers()
    });
}

export async function createLocation(data: z.input<typeof createLocationSchema>) {
    const session = await getSession();
    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    const activeOrganizationId = (session?.session as any)?.activeOrganizationId as string | undefined;

    if (!activeOrganizationId) {
        return { error: "No active organization" };
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

