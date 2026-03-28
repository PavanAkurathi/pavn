import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { LoadingScreen } from "../components/ui/loading-screen";
import { authClient } from "../lib/auth-client";
import { isExpoGo } from "../lib/runtime";

export default function Index() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void handleStartup();
    }, []);

    async function handleStartup() {
        try {
            if (!isExpoGo) {
                const { trackOpen } = require("@dub/react-native") as typeof import("@dub/react-native");
                const { link } = await trackOpen();
                if (link?.url) {
                    const match = link.url.match(/[?&]orgToken=([^&]+)/);
                    if (match?.[1]) {
                        const orgToken = decodeURIComponent(match[1]);
                        await SecureStore.setItemAsync("pending_invitation_token", orgToken);
                    }
                }
            }
        } catch (error) {
            console.warn("[Dub] Failed to extract deep link on startup:", error);
        }

        await checkSession();
    }

    async function checkSession() {
        try {
            const { data } = await authClient.getSession();
            router.replace(data ? "/(tabs)" : "/(auth)/login");
        } catch {
            router.replace("/(auth)/login");
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <LoadingScreen label="Starting Workers Hive" />;
    }

    return null;
}
