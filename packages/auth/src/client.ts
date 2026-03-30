// packages/auth/src/client.ts

import { createAuthClient } from "better-auth/react";
import { organizationClient, emailOTPClient, phoneNumberClient } from "better-auth/client/plugins";
import { dashClient } from "@better-auth/infra/client";
import { getWebAuthClientBaseUrl } from "./env";

import type { auth } from "./auth"; // Import type for inference

export const authClient = createAuthClient({
    baseURL: getWebAuthClientBaseUrl(),
    plugins: [
        dashClient(),
        organizationClient(),
        emailOTPClient(),
        phoneNumberClient(),
    ],
});

// Helper to export Session type for use in apps
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
