// packages/auth/src/auth.ts

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, emailOTP, phoneNumber } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { db } from "@repo/database";
import * as schema from "@repo/database/schema";
import { nanoid } from "nanoid";
import { sendOtp } from "@repo/email";
import { sendOTP } from "./providers/sms";

export const auth = betterAuth({
    appName: "Antigravity SaaS",
    secret: process.env.BETTER_AUTH_SECRET || "default_dev_secret_do_not_use_in_prod",
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

    // Crucial for Next.js 15+ / Server Actions environment
    trustedOrigins: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        // Expo Deep Linking Schema
        "exp://",
        "myapp://",
        // Development support
        "exp://**"
    ],

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
            invitation: schema.invitation
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
                after: async (user, ctx) => {
                    if (ctx?.body?.companyName) {
                        const companyName = ctx.body.companyName as string;
                        console.log(`[HOOK] Creating organization "${companyName}" for user ${user.id}`);

                        const orgId = nanoid();
                        const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(4);

                        try {
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
                        } catch (e) {
                            console.error("[HOOK] Failed to create organization:", e);
                        }
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
        expo(),
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
    ],
});
