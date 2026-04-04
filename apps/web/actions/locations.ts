"use server";

import { createLocationSchema } from "@repo/contracts/organizations";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiJsonRequest } from "@/lib/server/api-client";

export async function createLocation(data: z.input<typeof createLocationSchema>) {
    try {
        const parsed = createLocationSchema.safeParse(data);
        if (!parsed.success) {
            return { error: parsed.error.issues[0]?.message || "Invalid location" };
        }

        const result = await apiJsonRequest<{
            warning?: string;
        }>("/organizations/locations", {
            method: "POST",
            body: parsed.data,
            organizationScoped: true,
        });

        revalidatePath("/settings");
        revalidatePath("/dashboard/onboarding");
        revalidatePath("/dashboard/shifts");
        return {
            success: true,
            warning: result.warning,
        };
    } catch (error: any) {
        console.error("Failed to create location:", error);
        return { error: error.message || "Failed to create location" };
    }
}

export async function updateLocation(
    id: string,
    data: z.input<typeof createLocationSchema>,
) {
    try {
        const parsed = createLocationSchema.safeParse(data);
        if (!parsed.success) {
            return { error: parsed.error.issues[0]?.message || "Invalid location" };
        }

        await apiJsonRequest(`/organizations/locations/${id}`, {
            method: "PATCH",
            body: parsed.data,
            organizationScoped: true,
        });

        revalidatePath("/settings");
        revalidatePath("/dashboard/onboarding");
        revalidatePath("/dashboard/shifts");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update location:", error);
        return { error: error.message || "Failed to update location" };
    }
}

export async function deleteLocation(locationId: string) {
    try {
        await apiJsonRequest(`/organizations/locations/${locationId}`, {
            method: "DELETE",
            organizationScoped: true,
        });

        revalidatePath("/settings");
        revalidatePath("/dashboard/onboarding");
        revalidatePath("/dashboard/shifts");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete location:", error);
        return { error: error.message || "Failed to delete location" };
    }
}
