import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Configure how notifications behave when the app is in the foreground
// Skip on Android Expo Go to prevent crashes (feature removed in SDK 53)
if (Platform.OS !== 'android' || !isExpoGo) {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: false, // We use Soft Banner for foreground
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
            priority: Notifications.AndroidNotificationPriority.MAX,
        }),
    });
}

export async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android' && isExpoGo) {
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
    if (Platform.OS === 'android' && isExpoGo) {
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
