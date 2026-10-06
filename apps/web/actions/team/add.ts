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
            // error.message is a JSON dump of every issue; show the first one.
            return { error: parsed.error.issues[0]?.message ?? "Check the details and try again" };
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
