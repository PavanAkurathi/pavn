import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { DubProvider } from "@dub/react-native";
import * as Linking from "expo-linking";
import { useEffect } from "react";
import dub from "@dub/react-native";
import "../services/location"; // Register background tasks


export default function RootLayout() {

    // Track Deep Links
    useEffect(() => {
        const handleDeepLink = async (url: string | null) => {
            if (url) {
                try {
                    await dub.trackOpen(url);
                } catch (e) {
                    console.error("Dub track error:", e);
                }
            }
        };

        // 1. Initial Launch
        const checkInitial = async () => {
            const url = await Linking.getInitialURL();
            handleDeepLink(url);
        };
        checkInitial();

        // 2. Listeners
        const subscription = Linking.addEventListener("url", (event) => {
            handleDeepLink(event.url);
        });

        return () => {
            subscription.remove();
        };
    }, []);

    return (
        <DubProvider
            publishableKey={process.env.EXPO_PUBLIC_DUB_PUBLISHABLE_KEY || "dub_ext_placeholder"}
            domain={process.env.EXPO_PUBLIC_DUB_DOMAIN || "pavn.link"}
        >
            <SafeAreaProvider>
                <StatusBar style="light" />
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" />
                </Stack>
            </SafeAreaProvider>
        </DubProvider>
    );
}

