import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { organizationClient, phoneNumberClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

// Ideally from env, but hardcoded for dev (LAN IP for physical device testing)
// const BASE_URL = Constants.expoConfig?.hostUri 
//    ? `http://${Constants.expoConfig.hostUri.split(':')[0]}:4005` 
//    : "http://localhost:4005";

// Sticking to localhost for Simulator for now, user can change for real device
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4005";


export const authClient = createAuthClient({
    baseURL: BASE_URL,
    plugins: [
        organizationClient(),
        phoneNumberClient(),
        expoClient({
            scheme: "workers", // Must match app.json scheme
            storage: SecureStore,
        })
    ]
});
