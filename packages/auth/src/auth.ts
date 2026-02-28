// packages/auth/src/auth.ts

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, emailOTP, phoneNumber } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { expo } from "@better-auth/expo";
import { db } from "@repo/database";
import * as schema from "@repo/database/schema";
import { nanoid } from "nanoid";
import { sendOtp } from "@repo/email";
import { SUBSCRIPTION, OTP } from "@repo/config";
import { sendOTP, isValidPhoneNumber, normalizePhoneNumber } from "./providers/sms";

// ─── Environment Validation (fail fast, fail loud) ───────────────────────────

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`[AUTH FATAL] Missing required env var: ${key}`);
    return value;
}

const isProd = process.env.NODE_ENV === "production";

// In production, crash immediately if secret is missing.
// In dev/build, use a clearly labeled fallback.
const authSecret = isProd
    ? requireEnv("BETTER_AUTH_SECRET")
    : (process.env.BETTER_AUTH_SECRET ?? "dev_only_secret_not_for_production");

// ─── Trusted Origins ──────────────────────────────────────────────────────────

function buildTrustedOrigins(): string[] {
    const origins: string[] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",    // Expo web
    ];

    // Comma-separated list from env (Vercel, staging URLs, etc.)
    const fromEnv = process.env.ALLOWED_ORIGINS ?? "";
    if (fromEnv) {
        fromEnv.split(",").forEach((o) => {
            const trimmed = o.trim();
            if (trimmed) origins.push(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
        });
    }

    // Vercel deployment URL
    if (process.env.VERCEL_URL) {
        origins.push(`https://${process.env.VERCEL_URL}`);
    }

    // Retaining mobile deep link schemas as Next.js will receive them in the Origin header
    origins.push("exp://", "myapp://", "workers://", "exp://**");

    return [...new Set(origins)]; // deduplicate
}

const trustedOrigins = buildTrustedOrigins();

// ─── Stripe (conditionally initialized — no placeholder SDK) ─────────────────

function buildStripePlugin() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const priceId = process.env.STRIPE_PRICE_ID_MONTHLY;

    if (!secretKey || !webhookSecret || !priceId) {
        if (isProd) throw new Error("[AUTH FATAL] Missing Stripe env vars in production");
        console.warn("[AUTH] Stripe not initialized — missing env vars. Skipping plugin.");
        return null;
    }

    return stripe({
        stripeClient: new Stripe(secretKey, {
            apiVersion: "2025-12-15.clover" as any,
        }),
        stripeWebhookSecret: webhookSecret,
        createCustomerOnSignUp: true,
        subscription: {
            enabled: true,
            plans: [
                {
                    name: SUBSCRIPTION.PLAN_NAME,
                    priceId: priceId,
                    freeTrial: { days: SUBSCRIPTION.TRIAL_DAYS },
                }
            ]
        }
    });
}

const stripePlugin = buildStripePlugin();

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = betterAuth({
    appName: "Workers Hive",
    secret: authSecret,
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

    trustedOrigins: async (request) => {
        const origin = request?.headers.get("origin");

        // Allow LAN IPs in development only (Expo Go on physical device)
        if (!isProd && origin && /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin)) {
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
            subscription: schema.subscription,
        },
    }),

    // ── User Schema ────────────────────────────────────────────────────────────
    user: {
        additionalFields: {
            phoneNumber: { type: "string", fieldName: "phoneNumber" },
            role: { type: "string", fieldName: "role", defaultValue: "business" },
        },
    },

    // ── Email/Password disabled — we use OTP-only flows ───────────────────────
    emailAndPassword: {
        enabled: false,
    },

    // ── Database Hooks ─────────────────────────────────────────────────────────
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    const params = user as Record<string, unknown>;
                    if (typeof params.phoneNumber === "string" && params.phoneNumber) {
                        if (!isValidPhoneNumber(params.phoneNumber)) {
                            throw new Error("Invalid phone number. Use E.164 format e.g. +14155552671");
                        }
                        params.phoneNumber = normalizePhoneNumber(params.phoneNumber);
                    }
                    return { data: user };
                },
                after: async (user, ctx) => {
                    const companyName = (ctx?.body as Record<string, unknown>)?.companyName as string | undefined;
                    if (!companyName) return;

                    try {
                        const orgId = nanoid();
                        const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(4);

                        await db.insert(schema.organization).values({
                            id: orgId,
                            name: companyName,
                            slug,
                            createdAt: new Date(),
                            metadata: JSON.stringify({ description: "" }),
                        });

                        await db.insert(schema.member).values({
                            id: nanoid(),
                            organizationId: orgId,
                            userId: user.id,
                            role: "admin",
                            createdAt: new Date(),
                        });

                        console.log(`[AUTH] Org "${companyName}" (${orgId}) created for user ${user.id}`);
                    } catch (e) {
                        console.error(`[AUTH CRITICAL] Org creation failed for user ${user.id}:`, e);
                        await db
                            .update(schema.user)
                            .set({ metadata: JSON.stringify({ orgSetupFailed: true }) })
                            .where(schema.user.id.eq(user.id));
                        throw new Error("Account created but organization setup failed. Please contact support.");
                    }
                },
            },
            update: {
                before: async (user) => {
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
            disableOriginOverride: !isProd,
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
                    await sendOTP(phoneNumber, code);
                } catch (e) {
                    console.error(`[AUTH ERROR] Failed to send SMS OTP:`, e);
                    throw new Error("Failed to send SMS verification code. Please try again.");
                }
            },
            expiresIn: OTP.SMS_EXPIRY_SECONDS,
        }),
        ...(stripePlugin ? [stripePlugin] : []),
    ],
});
