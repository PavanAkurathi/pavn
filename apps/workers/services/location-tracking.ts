import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCATION_TASK_NAME = 'background-location-task';

/**
 * Configure and register the background location task
 */
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('[LOCATION] Task error:', error);
        return;
    }

    if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };

        // Log locally for now (WH-209 Requirement)
        // In future tickets, this will POST to backend


        try {
            // Optional: Store last location for debug
            const lastLocation = locations[0];
            if (lastLocation) {
                await AsyncStorage.setItem('last_background_location', JSON.stringify({
                    lat: lastLocation.coords.latitude,
                    lng: lastLocation.coords.longitude,
                    timestamp: lastLocation.timestamp
                }));
            }
        } catch (e) {
            console.error('[LOCATION] Failed to save location locally:', e);
        }
    }
});

/**
 * Start background tracking
 */
export async function startLocationTracking() {
    try {


        // 1. Foreground Permission
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
            console.warn('[LOCATION] Foreground permission denied');
            return false;
        }

        // 2. Background Permission
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
            console.warn('[LOCATION] Background permission denied');
            return false;
        }

        // 3. Start Tracking
        // console.log('[LOCATION] Starting background updates...');
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 50, // Update every 50 meters
            deferredUpdatesDistance: 50, // Battery optimization
            deferredUpdatesInterval: 60 * 1000, // Min 1 minute between updates
            showsBackgroundLocationIndicator: true, // Only for testing/debug (blue bar)
            foregroundService: {
                // Android Requirement (WH-208 placeholder)
                notificationTitle: "Tracking active",
                notificationBody: "We are tracking your location during the shift.",
            }
        });


        return true;

    } catch (error) {
        console.error('[LOCATION] Failed to start tracking:', error);
        return false;
    }
}

/**
 * Stop background tracking
 */
export async function stopLocationTracking() {
    try {
        const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isTracking) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

        }
    } catch (error) {
        console.error('[LOCATION] Failed to stop tracking:', error);
    }
}
