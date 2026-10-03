// packages/database/src/dev-seed-accounts.ts

/**
 * The accounts `db:seed` creates, shared with the dev sign-in link so
 * `/api/auth/dev-login?as=worker` knows which user to sign in as.
 *
 * Every seeded email sits on DEV_SEED_EMAIL_DOMAIN. The sign-in link only ever
 * resolves `as=` to that domain, so it can never be pointed at a real account.
 */

export const DEV_SEED_EMAIL_DOMAIN = "dev.pavn.test";

export const DEV_SEED_ORGANIZATION = {
    id: "org_dev_seed",
    name: "Pavn Dev Co",
    slug: "pavn-dev-co",
    timezone: "America/New_York",
} as const;

export interface DevSeedAccount {
    /** The `as=` value on the sign-in link. */
    alias: string;
    name: string;
    /** Role on the organization: "admin" runs the business, "member" is a worker. */
    memberRole: "admin" | "member";
    jobTitle: string;
    /** Workers sign in on the mobile app with this number. */
    phoneNumber?: string;
    hourlyRateCents?: number;
}

export const DEV_SEED_ACCOUNTS: readonly DevSeedAccount[] = [
    { alias: "owner", name: "Dev Owner", memberRole: "admin", jobTitle: "Owner" },
    { alias: "alex", name: "Alex Rivera", memberRole: "member", jobTitle: "Server", phoneNumber: "+15550001001", hourlyRateCents: 1800 },
    { alias: "sam", name: "Sam Okafor", memberRole: "member", jobTitle: "Bartender", phoneNumber: "+15550001002", hourlyRateCents: 2000 },
    { alias: "jordan", name: "Jordan Lee", memberRole: "member", jobTitle: "Host", phoneNumber: "+15550001003", hourlyRateCents: 1700 },
];

export const DEV_SEED_DEFAULT_ALIAS = "owner";

/** Email for a seeded account, or null when `alias` isn't one of them. */
export function devSeedEmail(alias: unknown): string | null {
    if (typeof alias !== "string") return null;
    const known = DEV_SEED_ACCOUNTS.some((account) => account.alias === alias);
    return known ? `${alias}@${DEV_SEED_EMAIL_DOMAIN}` : null;
}
