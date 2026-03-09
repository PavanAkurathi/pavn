import { Stack, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Toast from 'react-native-toast-message';
import "../services/location";
import "../services/geofencing";
import "../utils/notifications";
import { useEffect } from "react";

import * as Sentry from '@sentry/react-native';

import { ErrorBoundary } from "../components/ErrorBoundary";
import { DubProvider } from "@dub/react-native";
import { authClient } from "../lib/auth-client";
import { bootstrapOrganizationContext } from "../lib/organization-context";
import { workerTheme } from "../lib/theme";
import { isWorkersProd, optionalPublicEnv, requirePublicEnv } from "../lib/env";
import { syncGeofences } from "../services/geofencing";
import {
    registerForPushNotifications,
    setupNotificationHandlers,
} from "../services/push-notifications";

const DUB_PUBLISHABLE_KEY = isWorkersProd
    ? requirePublicEnv("EXPO_PUBLIC_DUB_PUBLISHABLE_KEY")
    : optionalPublicEnv("EXPO_PUBLIC_DUB_PUBLISHABLE_KEY") || "dev_only_dub_key";
const DUB_DOMAIN = process.env.EXPO_PUBLIC_DUB_DOMAIN || "links.workershive.com";

// Initialize Sentry conditionally
if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
        // Enable debug in dev (optional)
        debug: __DEV__,
    });
}

function RootLayout() {
    const router = useRouter();

    useEffect(() => {
        const removeNotificationHandlers = setupNotificationHandlers(
            () => undefined,
            (response) => {
                const url = response.notification.request.content.data?.url;
                if (typeof url === "string" && url.startsWith("/")) {
                    router.push(url as any);
                }
            }
        );

        void bootstrapWorkerApp();

        return removeNotificationHandlers;
    }, [router]);

    async function bootstrapWorkerApp() {
        try {
            const { data } = await authClient.getSession();
            if (!data?.user) {
                return;
            }

            await bootstrapOrganizationContext();

            await Promise.allSettled([
                registerForPushNotifications(),
                syncGeofences(),
            ]);
        } catch (error) {
            console.warn("[BOOTSTRAP] Worker app setup failed:", error);
        }
    }

    // ...

    return (
        <DubProvider publishableKey={DUB_PUBLISHABLE_KEY} domain={DUB_DOMAIN}>
            <SafeAreaProvider>
                <StatusBar style="dark" backgroundColor={workerTheme.colors.background} />
                <ErrorBoundary>
                    <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="(auth)" />
                    </Stack>
                </ErrorBoundary>
                <Toast />
            </SafeAreaProvider>
        </DubProvider>
    );
}

// Wrap for error boundary and sourcemaps only if initialized
const App = process.env.EXPO_PUBLIC_SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
export default App;
