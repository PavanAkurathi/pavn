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
        console.log(`[GEOFENCE] ${type}: ${region.identifier}`);

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
                        body: "Tap to clock in for your shift.",
                        data: { url: "/clock-in" },
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
        console.log('[GEOFENCE] Syncing...');

        // 1. Fetch upcoming shifts
        const shifts = await api.shifts.getUpcomingWithLocation();
        await registerGeofences(shifts);
    } catch (error) {
        console.error('[GEOFENCE] Sync failed:', error);
    }
}

export async function registerGeofences(shifts: WorkerShift[]) {
    const regions: Location.LocationRegion[] = [];

    for (const shift of shifts) {
        if (shift.location && shift.location.latitude && shift.location.longitude) {
            regions.push({
                identifier: shift.location.id,
                latitude: shift.location.latitude,
                longitude: shift.location.longitude,
                radius: shift.location.geofenceRadius || 100,
                notifyOnEnter: true,
                notifyOnExit: true,
            });
        }
    }

    if (regions.length > 0) {
        // Expo limits to 20 regions
        const limitedRegions = regions.slice(0, 20);

        await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, limitedRegions);
        console.log(`[GEOFENCE] Monitoring ${limitedRegions.length} regions`);
    } else {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
        console.log('[GEOFENCE] No active regions, stopped monitoring.');
    }
}
