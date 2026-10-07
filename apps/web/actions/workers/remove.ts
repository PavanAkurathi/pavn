"use server";

import { revalidatePath } from "next/cache";
import { apiJsonRequest } from "@/lib/server/api-client";

/** Takes a worker off the list; anyone with shift history is kept as inactive so their hours stay on record. */
export async function removeWorker(workerId: string) {
    try {
        await apiJsonRequest(`/organizations/crew/${encodeURIComponent(workerId)}`, {
            method: "DELETE",
            organizationScoped: true,
        });

        revalidatePath("/workers");
        revalidatePath("/schedule");
        return { success: true };
    } catch (error: any) {
        console.error("[RemoveWorker] Error:", error);
        return { error: error.message || "Failed to remove worker" };
    }
}
