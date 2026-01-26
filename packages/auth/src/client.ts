// packages/auth/src/client.ts

import { createAuthClient } from "better-auth/react";
import { organizationClient, emailOTPClient } from "better-auth/client/plugins";
import { stripeClient } from "@better-auth/stripe/client";
export { betterFetch } from "better-auth/client";
import type { auth } from "./auth"; // Import type for inference

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL,
    plugins: [
        organizationClient(),
        emailOTPClient(),
        stripeClient({
            subscription: true
        })
    ]
});

// Helper to export Session type for use in apps
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
