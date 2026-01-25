import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Try importing api from absolute path or checking structure
// Assuming api util exists in ../lib/api based on file structure scan
import { api } from '../lib/api';

const PUSH_TOKEN_KEY = 'push_token_registered';

/**
 * Register for push notifications (call on login and app launch)
 */
export async function registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
        console.log('[PUSH] Must use physical device for push notifications');
        return null;
    }

    // Check/request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('[PUSH] Permission denied');
        return null;
    }

    // Get Expo push token
    // Note: Project ID should be in app.json, but explicit config guarantees it works
    const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PROJECT_ID,
    });

    const pushToken = tokenData.data;

    // Check if already registered
    const lastRegistered = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (lastRegistered === pushToken) {
        console.log('[PUSH] Token already registered');
        return pushToken;
    }

    // Register with backend
    try {
        await api.post('/devices/register', {
            pushToken,
            platform: Platform.OS,
            deviceName: Device.deviceName || 'Unknown Device',
            appVersion: Device.osVersion || 'Unknown OS',
            osVersion: Device.osVersion || 'Unknown OS',
        });

        await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);
        console.log('[PUSH] Token registered:', pushToken.substring(0, 20) + '...');

        return pushToken;
    } catch (error) {
        console.error('[PUSH] Registration failed:', error);
        return null;
    }
}

/**
 * Setup notification handlers
 */
export function setupNotificationHandlers(
    onNotificationReceived: (notification: Notifications.Notification) => void,
    onNotificationTapped: (response: Notifications.NotificationResponse) => void
): () => void {
    // Handle notifications received while app is foregrounded
    const foregroundSubscription = Notifications.addNotificationReceivedListener(onNotificationReceived);

    // Handle notification taps
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(onNotificationTapped);

    // Return cleanup function
    return () => {
        foregroundSubscription.remove();
        responseSubscription.remove();
    };
}
