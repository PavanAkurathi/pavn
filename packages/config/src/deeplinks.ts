export const DEEPLINK_CONFIG = {
    universalLinkBase: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.workershive.com",
    scheme: "workershive",
    branchBaseUrl: process.env.BRANCH_BASE_URL ?? "https://link.workershive.com",

    buildInviteLink: (orgId: string, inviteToken: string): string => {
        const params: Record<string, string> = {
            org: orgId,
            token: inviteToken,
            $deeplink_path: `invite/${orgId}`,
        };

        if (process.env.APP_STORE_URL) params.$ios_url = process.env.APP_STORE_URL;
        if (process.env.PLAY_STORE_URL) params.$android_url = process.env.PLAY_STORE_URL;

        const searchParams = new URLSearchParams(params);
        return `${DEEPLINK_CONFIG.branchBaseUrl}/invite?${searchParams.toString()}`;
    },
} as const;
