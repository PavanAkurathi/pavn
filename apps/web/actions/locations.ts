"use server";

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LocationService, createLocationSchema } from "@repo/shifts/services/locations";

async function getSession() {
    return await auth.api.getSession({
        headers: await headers()
    });
}

export async function createLocation(data: z.infer<typeof createLocationSchema>) {
    const session = await getSession();
    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    const activeOrganizationId = (session?.session as any)?.activeOrganizationId as string | undefined;

    if (!activeOrganizationId) {
        return { error: "No active organization" };
    }

    try {
        await LocationService.create(activeOrganizationId, data);
        revalidatePath("/settings");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to create location:", error);
        return { error: error.message || "Failed to create location" };
    }
}

export async function updateLocation(id: string, data: z.infer<typeof createLocationSchema>) {
    const session = await getSession();
    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    const activeOrganizationId = (session?.session as any)?.activeOrganizationId as string | undefined;

    if (!activeOrganizationId) {
        return { error: "No active organization" };
    }

    try {
        await LocationService.update(activeOrganizationId, id, data);
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
        await LocationService.delete(activeOrganizationId, locationId);
        revalidatePath("/settings");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete location:", error);
        return { error: error.message || "Failed to delete location" };
    }
}

