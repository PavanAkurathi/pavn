import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, emailOTP } from "better-auth/plugins";
import { db } from "@repo/database";
import * as schema from "@repo/database/schema";
import { nanoid } from "nanoid";
import { sendOtp } from "@repo/email";

export const auth = betterAuth({
    appName: "Antigravity SaaS",
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

    // Crucial for Next.js 15+ / Server Actions environment
    trustedOrigins: [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
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

    emailAndPassword: {
        enabled: true,
        autoSignIn: true, // Signs in immediately, session created
        requireEmailVerification: true,
    },

    plugins: [
        organization({
            allowUserToCreateOrganization: false,
        }),
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                console.log(`[OTP DEBUG] Sending ${type} OTP to ${email}: ${otp}`);
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
    ],
});
