import { useEffect, useState } from "react";
import { useRouter } from "expo-router";

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
                await trackOpen();
            }
        } catch (error) {
            console.warn("[Dub] Failed to track deep link on startup:", error);
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
