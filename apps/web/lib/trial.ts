import { SUBSCRIPTION } from "@repo/config";

export type TrialState = {
    daysLeft: number;
    isExpiring: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days remaining in the free trial, or null when there is nothing to count down.
 *
 * There is no stored trial end yet — Stripe has not written a subscription row
 * for trialing orgs — so this derives it from when the workspace was created.
 * Once `subscription.trialEnd` is populated, prefer that value here.
 */
export function getTrialState(org: {
    createdAt?: string | Date | null;
    subscriptionStatus?: string | null;
} | null): TrialState | null {
    if (!org?.createdAt) {
        return null;
    }

    // A paying customer has no trial to count down.
    if (org.subscriptionStatus === "active") {
        return null;
    }

    const createdAt = new Date(org.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
        return null;
    }

    const endsAt = createdAt.getTime() + SUBSCRIPTION.TRIAL_DAYS * DAY_MS;
    const daysLeft = Math.ceil((endsAt - Date.now()) / DAY_MS);

    if (daysLeft <= 0) {
        return null;
    }

    return { daysLeft, isExpiring: daysLeft <= 3 };
}
