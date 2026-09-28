// packages/auth/src/dev-login.ts

/**
 * Private sign-in link for the development phase.
 *
 * GET /api/auth/dev-login?token=…&next=/schedule signs straight into one
 * account and lands on the app, so the owner can test the product without the
 * email, password or code screens in the way.
 *
 * Where the secret comes from, first match wins:
 *   1. DEV_LOGIN_TOKEN + DEV_LOGIN_EMAIL env vars on the API.
 *   2. DEVELOPMENT_SIGN_IN below: only a SHA-256 fingerprint of the secret is
 *      committed. A fingerprint of a 256-bit random value can't be turned back
 *      into it, so the link itself never appears in the repo.
 * DEV_LOGIN=off switches the link off everywhere. Before launch, set
 * DEVELOPMENT_SIGN_IN to null.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { logMessage } from "@repo/observability";

const MIN_TOKEN_LENGTH = 32;
const DEFAULT_NEXT = "/schedule";

type Account = { email: string } | { userId: string };

/** The owner's account in the development deployment (TestOne). Remove before launch. */
const DEVELOPMENT_SIGN_IN: { tokenSha256: string; account: Account } | null = {
    tokenSha256: "81d0127667f19514213414b9b7990df8fcfe2a06284018c09c2d5b769280b312",
    account: { userId: "AQj5jwUKWtogPkdBPHsr1bFtvSDbjjMu" },
};

export interface DevLoginConfig {
    tokenSha256: Buffer;
    account: Account;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/** Where the link's secret and account come from, or null when the link is off. */
export function readDevLoginConfig(
    env: Record<string, string | undefined> = process.env,
    committed: typeof DEVELOPMENT_SIGN_IN = DEVELOPMENT_SIGN_IN,
): DevLoginConfig | null {
    if (env.DEV_LOGIN?.trim().toLowerCase() === "off") return null;

    const token = env.DEV_LOGIN_TOKEN?.trim();
    const email = env.DEV_LOGIN_EMAIL?.trim().toLowerCase();
    if (token && email) {
        if (token.length < MIN_TOKEN_LENGTH) {
            console.warn(`[AUTH] DEV_LOGIN_TOKEN is shorter than ${MIN_TOKEN_LENGTH} characters; the sign-in link stays off.`);
            return null;
        }
        return { tokenSha256: sha256(token), account: { email } };
    }

    if (committed && /^[0-9a-f]{64}$/.test(committed.tokenSha256)) {
        return { tokenSha256: Buffer.from(committed.tokenSha256, "hex"), account: committed.account };
    }
    return null;
}

/** Constant-time comparison, so response timing says nothing about the secret. */
export function tokenMatches(expectedSha256: Buffer, given: unknown): boolean {
    if (typeof given !== "string" || given.length === 0) return false;
    return timingSafeEqual(expectedSha256, sha256(given));
}

/** Only same-site paths, so the link can't be turned into a redirect to another site. */
export function safeNextPath(next: unknown): string {
    if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
        return DEFAULT_NEXT;
    }
    return next;
}

export function devLogin(config: DevLoginConfig) {
    return {
        id: "dev-login",
        endpoints: {
            devLogin: createAuthEndpoint(
                "/dev-login",
                { method: "GET", requireHeaders: true },
                async (ctx) => {
                    const query = (ctx.query ?? {}) as Record<string, unknown>;
                    // A wrong secret looks exactly like a missing route.
                    if (!tokenMatches(config.tokenSha256, query.token)) {
                        throw new APIError("NOT_FOUND");
                    }

                    const { internalAdapter } = ctx.context;
                    const user =
                        "email" in config.account
                            ? (await internalAdapter.findUserByEmail(config.account.email))?.user
                            : await internalAdapter.findUserById(config.account.userId);
                    if (!user) {
                        logMessage("[AUTH] Dev login: the configured account doesn't exist here");
                        throw new APIError("NOT_FOUND");
                    }

                    const session = await internalAdapter.createSession(user.id);
                    if (!session) {
                        throw new APIError("INTERNAL_SERVER_ERROR", { message: "Couldn't start a session" });
                    }

                    await setSessionCookie(ctx, { session, user });
                    logMessage("[AUTH] Dev login used", { userId: user.id });
                    throw ctx.redirect(safeNextPath(query.next));
                },
            ),
        },
        rateLimit: [
            {
                pathMatcher: (path: string) => path.startsWith("/dev-login"),
                window: 60,
                max: 10,
            },
        ],
    } satisfies BetterAuthPlugin;
}
