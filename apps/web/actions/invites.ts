"use server";

import { revalidatePath } from "next/cache";
import { getApiSession } from "@/lib/server/auth-session";
import { apiJsonRequest } from "@/lib/server/api-client";

export async function resendInvite(memberId: string) {
    return apiJsonRequest<{ success: true; method: string }>(
        `/organizations/team/members/${memberId}/resend`,
        {
            method: "POST",
            organizationScoped: true,
        },
    );
}

export async function deleteMemberAction(memberId: string) {
    await apiJsonRequest(`/organizations/team/members/${memberId}`, {
        method: "DELETE",
        organizationScoped: true,
    });

    revalidatePath("/settings/team");
    revalidatePath("/rosters");
    return { success: true };
}

export async function resendTeamInvite(invitationId: string) {
    await apiJsonRequest(`/organizations/team/invitations/${invitationId}/resend`, {
        method: "POST",
        organizationScoped: true,
    });

    revalidatePath("/settings");
    revalidatePath("/settings/team");
    return { success: true };
}

export async function cancelTeamInvite(invitationId: string) {
    await apiJsonRequest(`/organizations/team/invitations/${invitationId}`, {
        method: "DELETE",
        organizationScoped: true,
    });

    revalidatePath("/settings");
    revalidatePath("/settings/team");
    return { success: true };
}

export async function acceptBusinessInvitation(invitationId: string) {
    const session = await getApiSession();

    if (!session) {
        throw new Error("Please sign in to accept this invitation.");
    }

    await apiJsonRequest(`/organizations/invitations/${invitationId}/accept`, {
        method: "POST",
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/onboarding");
    revalidatePath("/settings");
    return { success: true };
}
