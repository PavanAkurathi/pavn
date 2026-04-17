// packages/auth/src/auth.ts

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createAccessControl, organization, emailOTP, phoneNumber } from "better-auth/plugins";
import { dash } from "@better-auth/infra";
import { expo } from "@better-auth/expo";
import { db } from "@repo/database";
import * as schema from "@repo/database/schema";
import { sendOtp } from "@repo/email";
import { OTP } from "@repo/config";
import { sendOTP, isValidPhoneNumber, normalizePhoneNumber } from "./providers/sms";
import { getWorkerPhoneAccess, getWorkerTempEmail, syncWorkerMembershipsForPhone } from "./worker-access";
import {
    handleCreatedAuthUser,
    normalizeAuthPhoneNumber,
    resolveRequestedUserRole,
} from "./user-lifecycle";
import { logError, logMessage } from "@repo/observability";
import {
    buildTrustedOrigins,
    getBetterAuthInfraConnection,
    getBetterAuthServerBaseUrl,
    isAuthProd,
    requireAuthEnv,
} from "./env";

// Always require BETTER_AUTH_SECRET — no fallback in any environment.
// A missing secret in dev should fail fast, not silently use a known value.
const authSecret = requireAuthEnv("BETTER_AUTH_SECRET");

const trustedOrigins = buildTrustedOrigins();

function buildInfraPlugins() {
    const connection = getBetterAuthInfraConnection();
    if (!connection) {
        return [];
    }

    return [dash(connection)];
}

const infraPlugins = buildInfraPlugins();

const organizationAccessStatements = {
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    team: ["create", "update", "delete"],
    ac: ["create", "read", "update", "delete"],
} as const;

const organizationAccess = createAccessControl(organizationAccessStatements);

const adminOrganizationRole = organizationAccess.newRole({
    organization: ["update"],
    invitation: ["create", "cancel"],
    member: ["create", "update", "delete"],
    team: ["create", "update", "delete"],
    ac: ["create", "read", "update", "delete"],
});

const ownerOrganizationRole = organizationAccess.newRole({
    organization: ["update", "delete"],
    invitation: ["create", "cancel"],
    member: ["create", "update", "delete"],
    team: ["create", "update", "delete"],
    ac: ["create", "read", "update", "delete"],
});

const memberOrganizationRole = organizationAccess.newRole({
    organization: [],
    invitation: [],
    member: [],
    team: [],
    ac: ["read"],
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = betterAuth({
    appName: "Workers Hive",
    secret: authSecret,
    baseURL: getBetterAuthServerBaseUrl(),

    trustedOrigins: async (request: Request | undefined) => {
        const origin = request?.headers.get("origin");

        // Allow LAN IPs in development only (Expo Go on physical device)
        if (!isAuthProd && origin && /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin)) {
            return [...trustedOrigins, origin];
        }

        return trustedOrigins;
    },

    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification,
            organization: schema.organization,
            member: schema.member,
            invitation: schema.invitation,
        },
    }),

    // ── User Schema ────────────────────────────────────────────────────────────
    user: {
        additionalFields: {
            role: { type: "string", fieldName: "role", defaultValue: "admin" },
        },
    },

    // ── Email/Password ────────────────────────────────────────────────────────
    emailAndPassword: {
        enabled: true,
    },

    // ── Database Hooks ─────────────────────────────────────────────────────────
    databaseHooks: {
        user: {
            create: {
                before: async (user: Record<string, unknown>, ctx: Record<string, unknown> | null) => {
                    user.role = resolveRequestedUserRole(ctx);
                    normalizeAuthPhoneNumber(user);
                    return { data: user };
                },
                after: async (user: Record<string, unknown>, ctx: Record<string, unknown> | null) => {
                    await handleCreatedAuthUser(user, ctx);
                },
            },
            update: {
                before: async (user: Record<string, unknown>) => {
                    if (typeof user.phoneNumber === "string" && user.phoneNumber.startsWith("+")) {
                        try {
                            if (isValidPhoneNumber(user.phoneNumber)) {
                                user.phoneNumber = normalizePhoneNumber(user.phoneNumber);
                            }
                        } catch {
                            logMessage("[AUTH] Phone normalization failed on update — using as-is");
                        }
                    }
                    return { data: user };
                },
            },
        },
    },

    // ── Plugins ────────────────────────────────────────────────────────────────
    plugins: [
        expo({
            disableOriginOverride: false, // Ensure true origin override locally for physical devices
        }),
        organization({
            allowUserToCreateOrganization: false,
            creatorRole: "admin",
            requireEmailVerificationOnInvitation: true,
            roles: {
                admin: adminOrganizationRole,
                owner: ownerOrganizationRole,
                manager: adminOrganizationRole,
                member: memberOrganizationRole,
            },
        }),
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                try {
                    await sendOtp(email, otp);
                    logMessage(`[AUTH] Email OTP dispatched`, { type, emailPrefix: email.slice(0, 3) });
                } catch (e) {
                    logError(e, { context: "email_otp_send", emailPrefix: email.slice(0, 3) });
                    throw new Error("Failed to send verification code. Please try again.");
                }
            },
            sendVerificationOnSignUp: true,
            expiresIn: OTP.EMAIL_EXPIRY_SECONDS,
        }),
        phoneNumber({
            sendOTP: async ({ phoneNumber, code }) => {
                try {
                    const access = await getWorkerPhoneAccess(phoneNumber);
                    if (!access.eligible) {
                        throw new Error("This phone number has not been invited to any organization yet.");
                    }
                    await sendOTP(phoneNumber, code);
                } catch (e) {
                    logError(e, { context: "sms_otp_send" });
                    if (e instanceof Error && e.message.includes("has not been invited")) {
                        throw e;
                    }
                    throw new Error("Failed to send SMS verification code. Please try again.");
                }
            },
            expiresIn: OTP.SMS_EXPIRY_SECONDS,
            signUpOnVerification: {
                getTempEmail: (phoneNumber) => getWorkerTempEmail(phoneNumber),
                getTempName: (phoneNumber) => phoneNumber,
            },
            callbackOnVerification: async ({ phoneNumber }) => {
                const access = await getWorkerPhoneAccess(phoneNumber);
                if (!access.existingUserId) {
                    throw new Error("Failed to resolve worker account after phone verification.");
                }
                await syncWorkerMembershipsForPhone(access.existingUserId, phoneNumber);
            },
        }),
        ...infraPlugins,
    ],

    // ── Advanced Cookie Config ────────────────────────────────────────────────
    // Vercel's *.vercel.app is on the Public Suffix List, so cross-subdomain
    // cookie detection (dmn_chk_*) will always fail — browsers reject cookies
    // set on public suffixes. Disable it and let cookies default to the exact
    // host that serves the response (pavn-web.vercel.app via the auth proxy).
    advanced: {
        crossSubDomainCookies: {
            enabled: false,
        },
        defaultCookieAttributes: {
            secure: isAuthProd,
            sameSite: "lax" as const,
            path: "/",
        },
    },
});
