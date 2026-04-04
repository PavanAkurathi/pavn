"use server";

import { revalidatePath } from "next/cache";
import {
    WorkerInviteInputSchema,
    type WorkerInviteInput,
} from "@repo/contracts/workforce";
import { apiJsonRequest } from "@/lib/server/api-client";

type InviteWorkerResult = {
    success?: true;
    link?: string;
    error?: string;
};

export async function inviteWorker(
    rawInput: WorkerInviteInput,
): Promise<InviteWorkerResult> {
    try {
        const parsed = WorkerInviteInputSchema.safeParse(rawInput);
        if (!parsed.success) {
            return { error: "Invalid input data: " + parsed.error.message };
        }

        const result = await apiJsonRequest<{
            success: true;
            link?: string;
        }>("/organizations/crew/invitations", {
            method: "POST",
            body: parsed.data,
            organizationScoped: true,
        });

        revalidatePath("/rosters");
        revalidatePath("/settings/team");
        return result;
    } catch (error: any) {
        console.error("SERVER ACTION ERROR:", error);
        return { error: error.message || "Failed to invite worker" };
    }
}
