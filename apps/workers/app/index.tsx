import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { authClient } from "../lib/auth-client";

export default function Index() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkSession();
    }, []);

    async function checkSession() {
        try {
            const { data } = await authClient.getSession();
            if (data) {
                // router.replace("/(tabs)"); // Future: Navigate to tabs
                router.replace("/dashboard");
                // Actually, if logged in, we should go to main app. 
                // But since we are just restoring login, let's redirect to login if NO session, 
                // and if there IS a session, usually we go to tabs. 
                // Given the task is just "Restore Login", if there is a session, let's just show a "Logged In" text or similar until tabs are built.
                // Or better, let's just make it redirect to login if NOT logged in.
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
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            {/* Placeholder for Main App until Tabs are implemented */}
        </View>
    );
}
