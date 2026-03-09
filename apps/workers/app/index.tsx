// apps/workers/app/index.tsx

import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { authClient } from "../lib/auth-client";
import { useDub } from "@dub/react-native";
import * as SecureStore from "expo-secure-store";
import { workerTheme } from "../lib/theme";

export default function Index() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const dub = useDub();

    useEffect(() => {
        handleStartup();
    }, []);

    async function handleStartup() {
        try {
            // Check for Deferred Deep Link payload from Dub.co
            const { link } = await dub.trackOpen();
            if (link?.url) {
                // Example URL: https://workershive.com/join?orgToken=test_123
                // React Native URLSearchParams is not always available globally without a polyfill depending on RN version,
                // so we use a simple regex or string split to be safe.
                const match = link.url.match(/[?&]orgToken=([^&]+)/);
                if (match && match[1]) {
                    const orgToken = decodeURIComponent(match[1]);
                    await SecureStore.setItemAsync("pending_invitation_token", orgToken);
                    console.log("[Dub] Captured deferred deep link orgToken:", orgToken);
                }
            }
        } catch (e) {
            console.warn("[Dub] Failed to extract deep link on startup:", e);
        }

        checkSession();
    }

    async function checkSession() {
        try {
            const { data } = await authClient.getSession();
            if (data) {
                router.replace("/(tabs)");
            } else {
                router.replace("/(auth)/login");
            }
        } catch (e) {
            router.replace("/(auth)/login");
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: workerTheme.colors.background,
                }}
            >
                <ActivityIndicator size="large" color={workerTheme.colors.primary} />
            </View>
        );
    }

    return null;
}
