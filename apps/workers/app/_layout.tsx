import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Toast from 'react-native-toast-message';
import "../services/location";

import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

import { ErrorBoundary } from "../components/ErrorBoundary";

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
    );
}

// Wrap for error boundary and sourcemaps
export default Sentry.wrap(RootLayout);

