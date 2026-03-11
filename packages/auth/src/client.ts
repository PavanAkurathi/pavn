// packages/auth/src/client.ts

import { createAuthClient } from "better-auth/react";
import { organizationClient, emailOTPClient, phoneNumberClient } from "better-auth/client/plugins";
import { dashClient } from "@better-auth/infra/client";
import { stripeClient } from "@better-auth/stripe/client";

import type { auth } from "./auth.js"; // Import type for inference

const authBaseUrl =
    process.env.NEXT_PUBLIC_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

export const authClient = createAuthClient({
    baseURL: authBaseUrl,
    plugins: [
        dashClient(),
        organizationClient(),
        emailOTPClient(),
        phoneNumberClient(),
        stripeClient({
            subscription: true
        })
    ]
});

// Helper to export Session type for use in apps
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
