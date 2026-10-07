"use server";

import { revalidatePath } from "next/cache";
import {
    BulkWorkerInviteInputSchema,
    type BulkWorkerInviteInput,
} from "@repo/contracts/workforce";
import { apiJsonRequest } from "@/lib/server/api-client";

type BulkInviteWorkersResult = {
    success?: true;
    count?: number;
    skipped?: { id: string; name: string; reason: string }[];
    error?: string;
};

export async function bulkInviteWorkers(
    rawInput: BulkWorkerInviteInput,
): Promise<BulkInviteWorkersResult> {
    try {
        const parsed = BulkWorkerInviteInputSchema.safeParse(rawInput);
        if (!parsed.success) {
            return { error: "Invalid input data: " + parsed.error.message };
        }

        const result = await apiJsonRequest<{
            success: true;
            count: number;
            skipped: { id: string; name: string; reason: string }[];
        }>("/organizations/crew/invitations/bulk", {
            method: "POST",
            body: parsed.data,
            organizationScoped: true,
        });

        revalidatePath("/workers");
        return result;
    } catch (error: any) {
        console.error("BULK INVITE ERROR:", error);
        return { error: error.message || "Failed to process bulk invites" };
    }
}
