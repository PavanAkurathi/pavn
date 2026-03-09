import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, WorkerShift } from '../lib/api';

export const GEOFENCE_TASK_NAME = 'geofence-monitor-task';

/**
 * Define the Geofence Task
 */
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('[GEOFENCE] Task error:', error);
        return;
    }

    if (data) {
        const { eventType, region } = data as { eventType: Location.GeofencingEventType, region: Location.LocationRegion };

        const type = eventType === Location.GeofencingEventType.Enter ? 'ENTER' : 'EXIT';


        try {
            await AsyncStorage.setItem(`geofence_log_${Date.now()}`, JSON.stringify({
                type,
                regionId: region.identifier,
                timestamp: new Date().toISOString()
            }));

            if (type === 'ENTER') {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: "You've arrived!",
                        body: "Open the app to clock in or clock out.",
                        data: { url: "/(tabs)" },
                    },
                    trigger: null, // Immediate
                });
            }
        } catch (e) {
            console.error('[GEOFENCE] Failed to log event:', e);
        }
    }
});

/**
 * Sync Geofences based on upcoming shifts
 */
export async function syncGeofences() {
    try {
        // 1. Fetch upcoming shifts
        const result = await api.worker.getAllShifts('upcoming');
        await registerGeofences(result.shifts);
    } catch (error) {
        console.error('[GEOFENCE] Sync failed:', error);
    }
}

export async function registerGeofences(shifts: WorkerShift[]) {
    const regionsByLocation = new Map<string, Location.LocationRegion>();

    for (const shift of shifts) {
        if (
            shift.location &&
            typeof shift.location.latitude === 'number' &&
            typeof shift.location.longitude === 'number' &&
            !regionsByLocation.has(shift.location.id)
        ) {
            regionsByLocation.set(shift.location.id, {
                identifier: shift.location.id,
                latitude: shift.location.latitude,
                longitude: shift.location.longitude,
                radius: shift.location.geofenceRadius || 100,
                notifyOnEnter: true,
                notifyOnExit: true,
            });
        }
    }

    const regions = Array.from(regionsByLocation.values());

    if (regions.length > 0) {
        // Expo limits to 20 regions
        const limitedRegions = regions.slice(0, 20);

        await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, limitedRegions);

    } else {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);

    }
}
