import * as SecureStore from "expo-secure-store";
import { CONFIG } from "./config";

export type WorkerEligibilityResponse = {
    eligible: boolean;
    organizationCount: number;
    existingAccount: boolean;
};

type VerifyPhoneResponse = {
    data?: {
        token?: string;
    };
    error?: {
        message?: string;
    };
};

export async function checkWorkerEligibility(phoneNumber: string): Promise<WorkerEligibilityResponse> {
    const response = await fetch(`${CONFIG.API_URL}/worker/auth/eligibility`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber }),
    });

    if (!response.ok) {
        throw new Error("We could not verify your worker access right now.");
    }

    return response.json() as Promise<WorkerEligibilityResponse>;
}

export async function persistWorkerSession(response: VerifyPhoneResponse): Promise<void> {
    if (!response.data?.token) {
        return;
    }

    await SecureStore.setItemAsync("better-auth.session_token", response.data.token);
    await SecureStore.deleteItemAsync("pending_invitation_token");
}
