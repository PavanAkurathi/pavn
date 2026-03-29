// packages/auth/src/auth.ts

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { organization, emailOTP, phoneNumber } from "better-auth/plugins";
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
import {
    buildTrustedOrigins,
    getBetterAuthInfraConnection,
    getBetterAuthServerBaseUrl,
    isAuthProd,
    requireAuthEnv,
} from "./env";

// In production, crash immediately if secret is missing.
// In dev/build, use a clearly labeled fallback.
const authSecret = isAuthProd
    ? requireAuthEnv("BETTER_AUTH_SECRET")
    : (process.env.BETTER_AUTH_SECRET ?? "dev_only_secret_not_for_production");

const trustedOrigins = buildTrustedOrigins();

function buildInfraPlugins() {
    const connection = getBetterAuthInfraConnection();
    if (!connection) {
        return [];
    }

    return [dash(connection)];
}

const infraPlugins = buildInfraPlugins();

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
                before: async (user: any, ctx: any) => {
                    const params = user as Record<string, unknown>;
                    params.role = resolveRequestedUserRole(ctx);
                    normalizeAuthPhoneNumber(params);
                    return { data: user };
                },
                after: async (user: any, ctx: any) => {
                    await handleCreatedAuthUser(user, ctx);
                },
            },
            update: {
                before: async (user: any) => {
                    const params = user as Record<string, unknown>;
                    if (typeof params.phoneNumber === "string" && params.phoneNumber.startsWith("+")) {
                        try {
                            if (isValidPhoneNumber(params.phoneNumber)) {
                                params.phoneNumber = normalizePhoneNumber(params.phoneNumber);
                            }
                        } catch {
                            console.warn("[AUTH] Phone normalization failed on update — using as-is");
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
        }),
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                try {
                    await sendOtp(email, otp);
                    console.log(`[AUTH] Email OTP (${type}) dispatched to ${email.slice(0, 3)}***`);
                } catch (e) {
                    console.error(`[AUTH ERROR] Failed to send email OTP to ${email}:`, e);
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
                    console.error(`[AUTH ERROR] Failed to send SMS OTP:`, e);
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
});
