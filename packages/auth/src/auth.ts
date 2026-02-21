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
import { sendOTP, isValidPhoneNumber, normalizePhoneNumber } from "./providers/sms";

const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || "";
const vercelUrl = process.env.VERCEL_URL;
const trustedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(allowedOriginsEnv.split(',').map(o => {
        const origin = o.trim();
        if (origin.startsWith('http')) return origin;
        return `https://${origin}`;
    }).filter(Boolean)),
    vercelUrl ? `https://${vercelUrl}` : undefined,
    "exp://",
    "myapp://",
    "workers://",
    "http://10.0.0.38:8081",
    "exp://10.0.0.38:8081",
    "exp://**"
].filter(Boolean) as string[];

console.log("[AUTH DEBUG] Allowed Origins Env:", allowedOriginsEnv);
console.log("[AUTH DEBUG] Vercel URL Env:", vercelUrl);
console.log("[AUTH DEBUG] Final Trusted Origins:", trustedOrigins);
console.log("[AUTH DEBUG] Request Origin Validation Enabled");

export const auth: ReturnType<typeof betterAuth> = betterAuth({
    appName: "Antigravity SaaS",
    secret: (() => {
        if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;

        // CRITICAL: Fail fast in production
        if (process.env.NODE_ENV === "production") {
            throw new Error("FATAL: BETTER_AUTH_SECRET is missing in production environment");
        }

        // Fallback for verification/build/dev steps where env might be missing
        console.warn("⚠️ BETTER_AUTH_SECRET is missing. Using default for build/dev.");
        return "default_build_secret_do_not_use_in_prod";
    })(),
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

    // Crucial for Next.js 15+ / Server Actions environment
    trustedOrigins: trustedOrigins,

    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.user,
            session: schema.session,
            // ✅ UNCOMMENTED: We need this for the password storage to work correctly
            account: schema.account,
            verification: schema.verification,
            organization: schema.organization,
            member: schema.member,
            invitation: schema.invitation,
            subscription: schema.subscription
        }
    }),

    user: {
        additionalFields: {
            phoneNumber: {
                type: "string",
                fieldName: "phoneNumber",
            },
        },
    },

    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    try {
                        const params = user as any;
                        if (params.phoneNumber) {
                            const phone = params.phoneNumber as string;
                            if (!isValidPhoneNumber(phone)) {
                                throw new Error("Invalid phone number. Please use E.164 format (e.g. +14155552671)");
                            }
                            params.phoneNumber = normalizePhoneNumber(phone);
                        }
                        return { data: user };
                    } catch (e) {
                        console.error("[HOOK ERROR] User create before hook failed:", e);
                        throw e;
                    }
                },
                after: async (user, ctx) => {
                    try {
                        if (ctx?.body?.companyName) {
                            const companyName = ctx.body.companyName as string;
                            console.log(`[HOOK] Creating organization "${companyName}" for user ${user.id}`);

                            const orgId = nanoid();
                            const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(4);

                            await db.insert(schema.organization).values({
                                id: orgId,
                                name: companyName,
                                slug: slug,
                                createdAt: new Date(),
                                metadata: JSON.stringify({ description: "" })
                            });

                            await db.insert(schema.member).values({
                                id: nanoid(),
                                organizationId: orgId,
                                userId: user.id,
                                role: "admin",
                                createdAt: new Date()
                            });

                            console.log(`[HOOK] Successfully created Org "${companyName}" (${orgId})`);
                        }
                    } catch (e) {
                        console.error("[HOOK ERROR] User create after hook failed:", e);
                        // Do not throw here to allow user creation to succeed even if org creation fails
                    }
                }
            },
            update: {
                before: async (user) => {
                    try {
                        const params = user as any;
                        if (params.phoneNumber) {
                            const phone = params.phoneNumber as string;
                            // Only validate and normalize if it looks like a phone number
                            // During verification, Better Auth might pass other data
                            if (phone && phone.startsWith('+')) {
                                try {
                                    if (isValidPhoneNumber(phone)) {
                                        params.phoneNumber = normalizePhoneNumber(phone);
                                    }
                                } catch (validationError) {
                                    // Log but don't throw - allow the update to proceed
                                    console.warn("[HOOK WARNING] Phone number validation failed, using as-is:", validationError);
                                }
                            }
                        }
                        return { data: user };
                    } catch (e) {
                        console.error("[HOOK ERROR] User update before hook failed:", e);
                        // Don't throw - allow the update to proceed
                        return { data: user };
                    }
                }
            }
        }
    },

    emailAndPassword: {
        enabled: true,
        autoSignIn: true, // Signs in immediately, session created
        requireEmailVerification: false, // We will enforce this in middleware/proxy instead
    },

    plugins: [
        expo({
            disableOriginOverride: true,
        }),
        organization({
            allowUserToCreateOrganization: true,
        }),
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                if (process.env.NODE_ENV === "development") {
                    console.log(`[OTP DEBUG] Sending ${type} OTP to ${email}: ${otp}`);
                } else {
                    console.log(`[OTP] Sending ${type} OTP to ${email}: ****`);
                }
                try {
                    // Check if sendOtp is actually implemented
                    if (sendOtp) {
                        await sendOtp(email, otp);
                    } else {
                        console.warn("[OTP WARNING] @repo/email sendOtp is not defined");
                    }
                } catch (e) {
                    console.error(`[OTP ERROR] Failed to send:`, e);
                }
            },
            sendVerificationOnSignUp: true,
        }),
        phoneNumber({
            sendOTP: async ({ phoneNumber, code }) => {
                await sendOTP(phoneNumber, code);
            },
        }),
        stripe({
            stripeClient: new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
                apiVersion: "2025-12-15.clover" as any, // Match SDK version
            }),
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "whsec_placeholder",
            createCustomerOnSignUp: !(process.env.STRIPE_SECRET_KEY || "placeholder").includes("placeholder"),
            subscription: {
                enabled: true,
                plans: [
                    {
                        name: "pro",
                        priceId: process.env.STRIPE_PRICE_ID_MONTHLY || "price_default",
                        freeTrial: {
                            days: 14
                        }
                    }
                ]
            }
        })
    ],
});
