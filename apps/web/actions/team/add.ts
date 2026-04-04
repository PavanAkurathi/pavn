"use server";

import { revalidatePath } from "next/cache";
import {
    TeamMemberInvitationInputSchema,
    type TeamMemberInvitationInput,
} from "@repo/contracts/organizations";
import { apiJsonRequest } from "@/lib/server/api-client";

type AddMemberResult = {
    success?: true;
    invitationId?: string;
    error?: string;
};

export async function addMember(
    rawInput: TeamMemberInvitationInput,
): Promise<AddMemberResult> {
    try {
        const parsed = TeamMemberInvitationInputSchema.safeParse(rawInput);
        if (!parsed.success) {
            return { error: "Invalid input data: " + parsed.error.message };
        }

        const result = await apiJsonRequest<{
            success: true;
            invitationId?: string;
        }>("/organizations/team/invitations", {
            method: "POST",
            body: parsed.data,
            organizationScoped: true,
        });

        revalidatePath("/settings");
        revalidatePath("/settings/team");
        return result;
    } catch (error: any) {
        console.error("SERVER ACTION ERROR:", error);
        return { error: error.message || "Failed to add member" };
    }
}
