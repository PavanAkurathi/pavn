export const DEEPLINK_CONFIG = {
    universalLinkBase: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.workershive.com",
    scheme: "workershive",
    branchBaseUrl: process.env.BRANCH_BASE_URL ?? "https://link.workershive.com",

    buildInviteLink: (orgId: string, inviteToken: string): string => {
        const params = new URLSearchParams({
            org: orgId,
            token: inviteToken,
            $deeplink_path: `invite/${orgId}`,
            $ios_url: process.env.APP_STORE_URL ?? "",
            $android_url: process.env.PLAY_STORE_URL ?? "",
        });
        return `${DEEPLINK_CONFIG.branchBaseUrl}/invite?${params.toString()}`;
    },
} as const;
