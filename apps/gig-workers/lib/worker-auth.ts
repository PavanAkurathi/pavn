import { CONFIG } from "./config";

export type WorkerEligibilityResponse = {
    eligible: boolean;
    organizationCount: number;
    existingAccount: boolean;
    /** Set when an invite code came along and didn't check out. */
    reason?: "invalid_code" | "code_mismatch";
};

export type WorkerInviteSummary = {
    organizationName: string;
    workerName: string;
    phoneHint: string | null;
};

type VerifyPhoneResponse = {
    data?: {
        token?: string;
    };
    error?: {
        message?: string;
    };
};

export async function checkWorkerEligibility(
    phoneNumber: string,
    inviteCode?: string | null,
): Promise<WorkerEligibilityResponse> {
    const response = await fetch(`${CONFIG.API_URL}/worker/auth/eligibility`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(inviteCode ? { phoneNumber, inviteCode } : { phoneNumber }),
    });

    if (!response.ok) {
        throw new Error("We could not verify your worker access right now.");
    }

    return response.json() as Promise<WorkerEligibilityResponse>;
}

/** Who an invite code is from, or null when it isn't valid (anymore). */
export async function lookupWorkerInvite(inviteCode: string): Promise<WorkerInviteSummary | null> {
    const response = await fetch(
        `${CONFIG.API_URL}/worker/auth/invite/${encodeURIComponent(inviteCode)}`,
    );

    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        throw new Error("We could not check your invite right now.");
    }

    return response.json() as Promise<WorkerInviteSummary>;
}

export async function persistWorkerSession(response: VerifyPhoneResponse): Promise<void> {
    if (!response.data?.token) {
        return;
    }

    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync("better-auth.session_token", response.data.token);
}
