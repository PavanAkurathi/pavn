"use server";

import {
    OrganizationProfileUpdateSchema,
    type OrganizationProfileUpdate,
} from "@repo/contracts/organizations";
import { revalidatePath } from "next/cache";
import { apiJsonRequest } from "@/lib/server/api-client";

export async function updateOrganization(data: OrganizationProfileUpdate) {
    const parsed = OrganizationProfileUpdateSchema.safeParse(data);
    if (!parsed.success) {
        return {
            error:
                "Invalid input: " +
                (parsed.error.issues[0]?.message || "Unknown error"),
        };
    }

    try {
        await apiJsonRequest("/organizations/profile", {
            method: "PATCH",
            body: parsed.data,
            organizationScoped: true,
        });

        revalidatePath("/settings");
        revalidatePath("/dashboard/onboarding");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update organization:", error);
        return { error: error.message || "Failed to update organization" };
    }
}

export async function markBillingPromptHandled() {
    try {
        await apiJsonRequest("/organizations/profile/billing-prompt-handled", {
            method: "POST",
            organizationScoped: true,
        });

        revalidatePath("/settings");
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/onboarding");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to mark billing prompt handled:", error);
        return { error: error.message || "Failed to update onboarding progress" };
    }
}
