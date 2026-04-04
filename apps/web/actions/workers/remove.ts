"use server";

import { revalidatePath } from "next/cache";
import { apiJsonRequest } from "@/lib/server/api-client";

export async function removeWorker(rawEmail: string) {
    try {
        await apiJsonRequest("/organizations/crew/remove", {
            method: "POST",
            body: { email: rawEmail },
            organizationScoped: true,
        });

        revalidatePath("/rosters");
        revalidatePath("/settings/team");
        return { success: true };
    } catch (error: any) {
        console.error("[RemoveWorker] Error:", error);
        return { error: error.message || "Failed to remove worker" };
    }
}
