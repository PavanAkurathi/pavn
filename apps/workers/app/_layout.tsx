import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Toast from 'react-native-toast-message';
import "../services/location";

import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

import { ErrorBoundary } from "../components/ErrorBoundary";
import { DubProvider } from "@dub/react-native";

const DUB_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_DUB_PUBLISHABLE_KEY || "pk_test_placeholder";
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

    // ...

    return (
        <DubProvider publishableKey={DUB_PUBLISHABLE_KEY} domain={DUB_DOMAIN}>
            <SafeAreaProvider>
                <StatusBar style="light" />
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

