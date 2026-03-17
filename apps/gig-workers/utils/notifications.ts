import { Platform } from "react-native";
import { isAndroidExpoGo } from "../lib/runtime";

let notificationHandlerConfigured = false;

function getNotificationsModule(): typeof import("expo-notifications") | null {
    if (isAndroidExpoGo) {
        return null;
    }

    return require("expo-notifications") as typeof import("expo-notifications");
}

export function configureForegroundNotifications(): void {
    if (notificationHandlerConfigured) {
        return;
    }

    const Notifications = getNotificationsModule();
    if (!Notifications) {
        console.log("Skipping notification handler setup in Expo Go (Android)");
        return;
    }

    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
        }),
    });

    notificationHandlerConfigured = true;
}

export async function registerForPushNotificationsAsync() {
    const Notifications = getNotificationsModule();
    if (!Notifications) {
        console.log('Skipping Push Notification registration in Expo Go (Android)');
        return null; // Graceful exit
    }

    let token;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        // Permission not granted
        return null;
    }

    // On Android, we need to specify a channel
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    return finalStatus;
}

export async function scheduleLocalNotification(title: string, body: string, triggerSeconds: number = 0) {
    const Notifications = getNotificationsModule();
    if (!Notifications) {
        console.log('Skipping Local Notification schedule in Expo Go (Android)');
        return;
    }

    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: true,
        },
        trigger: triggerSeconds > 0 ? { seconds: triggerSeconds, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL } : null,
    });
}
