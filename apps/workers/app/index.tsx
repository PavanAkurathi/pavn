// apps/workers/app/index.tsx

import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { authClient } from "../lib/auth-client";
import * as SecureStore from "expo-secure-store";
import { isExpoGo } from "../lib/runtime";
import { workerTheme } from "../lib/theme";

export default function Index() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        handleStartup();
    }, []);

    async function handleStartup() {
        try {
            if (!isExpoGo) {
                const { trackOpen } = require("@dub/react-native") as typeof import("@dub/react-native");
                const { link } = await trackOpen();
                if (link?.url) {
                    const match = link.url.match(/[?&]orgToken=([^&]+)/);
                    if (match && match[1]) {
                        const orgToken = decodeURIComponent(match[1]);
                        await SecureStore.setItemAsync("pending_invitation_token", orgToken);
                        console.log("[Dub] Captured deferred deep link orgToken:", orgToken);
                    }
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
